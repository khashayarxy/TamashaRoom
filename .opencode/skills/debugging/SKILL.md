---
name: debugging
description: How to debug TamashaRoom efficiently — reproduce with existing tests first, where errors surface (Laravel log, Sentry, exception handler), the polling/presence timing constants, E2E flake handling, and the shared-hosting failure modes to check first. Use when a bug is reported, a test fails unexpectedly, or behavior doesn't match expectations.
---

# Debugging TamashaRoom

Debug against the codebase, not assumptions. The fastest path is usually:
reproduce with a test → read the exact code path → fix → re-run the filtered
test. Full detail: `docs/SYSTEM.md` for the relevant subsystems.

## Step 0 — Reproduce with a Test Before Touching Anything

- Backend: write or run a focused feature test
  (`php artisan test --filter=RelevantTest`) that exercises the failing path.
- Frontend: `npx vitest run <file>` for the module, or a Playwright E2E
  (`npm run test:e2e`) for a user-flow bug.
- If you can't reproduce, you can't verify the fix. A failing test that
  captures the bug is the first deliverable.

## Where Errors Surface (check these first)

- `storage/logs/laravel.log` — application log; check the timestamp of the
  failure. Production uses `LOG_CHANNEL=daily` (14-day rotation).
- **Sentry** (if `SENTRY_DSN` set) — production errors and traces.
- The exception handler (`bootstrap/app.php:48-66`):
  - `shouldRenderJsonWhen` — `api/*` or `expectsJson()` requests get JSON.
  - `VideoUrlValidationException` renders as 422 JSON.
  - Non-HTTP exceptions with `APP_DEBUG=false` render generic `Server Error`.
- `APP_DEBUG` is **false in production** — a "Server Error" with a log
  message means check the log, not the response body.

## The Polling Timings (symptoms map to these)

| Mechanic | Interval | File |
|---|---|---|
| Playback sync (active) | 3,000 ms | `use-playback-sync.ts:13` |
| Playback sync (idle/paused) | 10,000 ms | `use-playback-sync.ts:14` |
| Presence heartbeat | 30,000 ms | `use-presence.ts:21` |
| Presence member list poll | 5,000 ms | `use-presence.ts:22` |
| Presence timeout (stale→offline) | 90 s | `PresenceService` |
| Presence reconnect backoff | 30s → 60s → … → 5min max | `use-presence.ts:23` |

"Playback doesn't sync" → check the poll is running (network tab), then the
`GET /playback/{room}/state` response, then `state_version` increments.
"Member shows online forever" → `presence:timeout` needs the scheduler
running (`php artisan schedule:list`; the single cron entry).

## Shared-Hosting Failure Modes to Rule Out Early

- **Stale config/route cache** — if an env/route change seems ignored,
  `php artisan config:clear && php artisan route:clear` (or re-cache).
- **Missing storage symlink** — subtitle upload 404s → `php artisan storage:link`.
- **Queue backlog** — jobs only drain on the scheduled
  `queue:work --stop-when-empty` tick.
- **N+1 under load** — `preventLazyLoading` is off in production; check
  `laravel.log` for slow queries after Eloquent changes.
- **Rate limited** — 429 responses. Current per-endpoint limits are owned
  by `security-rules`; the limiters live in `AppServiceProvider`. A 429 that
  fires below the documented limit usually means the database cache store is
  shared/persisted from a previous run — `Cache::flush()` in test setup is
  the norm, not the exception.

## Video Proxy Debugging

- `GET /proxy/video/{room}` requires auth + `memberAccess` + `throttle:proxy`.
- Responses: 400 invalid URL/range, 404 no video source, 416 bad range,
  502 upstream unreachable. 502 → check the upstream URL and
  `UrlSecurityService` rejection (private IPs blocked; SSRF rules in
  `security-rules`).
- Streaming is capped at `MAX_FILE_SIZE` (4 GiB) on actual relayed bytes —
  a truncated stream near the cap is the limit, not a bug.

## Frontend Debugging

- jsdom doesn't implement media APIs — `HTMLMediaElement.prototype.pause`
  "Not implemented" stderr noise in Vitest is **expected and harmless**;
  tests still pass. Don't "fix" it.
- Polling hooks (`usePlaybackSync`, `usePresence`) use fake timers in tests;
  if a test flakes on timing, it's a test problem, not app behavior.
- E2E: run against the dev server; if a single spec times out once, re-run
  it in isolation (`npx playwright test -g "test name"`) before treating it
  as a regression — full-suite runs on one worker can flake under load.

## Checklist

- Reproduced with a focused test before changing code.
- Checked `storage/logs/laravel.log` + Sentry for the exact error.
- Ruled out cache/symlink/queue/rate-limit/SSRF causes first.
- Matched the symptom against the polling timings table.
- Fix verified with the same filtered test that reproduced it.
- Full relevant suite run before considering it done.
