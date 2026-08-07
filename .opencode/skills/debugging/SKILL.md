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
| Playback sync (active) | 3,000 ms | `use-playback-sync.ts:14` |
| Playback sync (idle/paused) | 10,000 ms | `use-playback-sync.ts:15` |
| Presence heartbeat | 30,000 ms | `use-presence.ts:23` |
| Presence member list poll | 5,000 ms | `use-presence.ts:24` |
| Presence timeout (stale→offline) | 90 s | `PresenceService` |
| Presence reconnect backoff | 30s → 60s → … → 5min max | `use-presence.ts:25` |

"Playback doesn't sync" → check the poll is running (network tab), then the
`GET /playback/{room}/state` response, then `state_version` increments.
"Member shows online forever" → `presence:timeout` needs the scheduler
running (`php artisan schedule:list`; the single cron entry).

## Shared-Hosting Failure Modes to Rule Out Early

- **Stale config/route cache** — if an env/route change seems ignored,
  `php artisan config:clear && php artisan route:clear` (or re-cache).
- **Private subtitle storage failure** — subtitle upload/read errors → verify
  `storage/app/private/` is writable and the `local` disk is configured; the
  public `storage:link` is not involved.
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

## Debug Logging Conventions

- Backend: name temporary debug lines with the `[debug:<topic>]` prefix:
  `Log::debug('[debug:proxy] range request', ['room' => $roomId, 'range' => $range])`.
  This keeps debug output greppable (`grep "\[debug:" storage/logs/laravel.log`)
  and instantly removable.
- Frontend: use `debug(topic, ...)` from `@/lib/debug` (gated behind
  `VITE_DEBUG=true`, namespaced `[debug:<topic>]`).
- Debug logging is a **temporary tool**: remove `[debug:` call sites and
  `VITE_DEBUG` flags from the final diff (see `code-review-rules`).

## Known Issues

> A quick index of recurring, diagnosed bugs struck during development. If you
> hit a symptom that matches a row, read that row first — the root cause and
> fix are already known, so you are fixing a regression or a variant, not
> rediscovering it. Each entry deliberately omits line numbers because they
> drift; locate the fix point by the code-area column and the surrounding
> feature.
>
> Security/ops findings that went through the formal verification loop live in
> the authoritative `docs/ai/ISSUE_REGISTER.md` (TAM-*) — do not copy those
> into the table; cross-reference by TAM ID instead. Deployment/ops items are
> TAM-006, TAM-008.

Check this skill when:

- E2E test fails intermittently (flake)
- CI/GitHub Actions fails (especially on ubuntu-latest but passes locally)
- Sync behavior unexpected (feedback loop, drift, reset)
- UI state lost (tab switch, refresh, unmount)
- CSP/security errors in production-like config
- CSRF/beacon failures
- Proxy/streaming timeouts or SSRF concerns
- Dark mode/theme inconsistencies
- Email uniqueness collisions in tests
- Node.js deprecation warnings in CI
- Gitleaks or security scan failures
- Build/asset failures in CI but not locally

| ID | Symptom | Root Cause | Fix | Where |
|---|---|---|---|---|
| KI-001 | Host/guest sync feedback loop, currentTime resets | sourceUrl change remounted `<video>`, resetting position | Video.js v10 `store.loadSource()` mutates same `<video>` element; listeners bind once | `VideoJsPlayer.tsx`, `lib/player-source.ts` |
| KI-002 | Chat messages vanish on tab switch | Component-local state lost on conditional unmount | Both panels stay mounted; switch via CSS `hidden`/`h-full` | `Pages/Rooms/Show.tsx`, `room-chat.tsx` |
| KI-003 | Dark mode toggle needs two clicks first time | Store defaulted `dark: true` but never applied class on load | Apply `document.documentElement.classList.toggle("dark", ...)` on module init | `stores/theme.ts` |
| KI-004 | E2E setup-verified-room fails intermittently | Faker `unique()->safeEmail()` resets per PHP process reboot | Use `test_helper_user_email() = 'e2e-' . Str::random(12) . '@example.com'` | `routes/test-helpers.php` |
| KI-005 | Presence-moments leave missing in E2E | `.first()` matched owner's reconnect, not guest's join | Gate leave on guest's named join moment via `waitForGuestOnline` | `tests/e2e/presence-moments.spec.ts` |
| KI-006 | CSP blocks Ziggy routes script | `@routes()` had no nonce in strict CSP | `@routes(nonce: $cspNonce ?? null)` | `resources/views/app.blade.php`, `SecurityHeadersMiddleware.php` |
| KI-007 | `sendBeacon` CSRF failure on leave | Beacon sent no body/headers/token | Send `_token` via multipart `FormData` body | `use-presence.ts` |
| KI-008 | Long proxy streams timeout | `set_time_limit` not reset per chunk | `resetTimeLimit()` inside per-chunk relay loop | `VideoProxyService.php` |
| KI-009 | SSRF via proxy redirects | Auto-followed redirects bypassed validation | Manual redirect loop with per-hop `validateVideoUrl` | `VideoProxyService.php` |
| KI-010 | CI: Inertia page path casing failure | Windows (NTFS case-insensitive) vs ubuntu-latest (ext4 case-sensitive) | Publish `config/inertia.php` with exact repo casing `js/Pages` | `config/inertia.php` |
| KI-011 | CI: Gitleaks scan fails on multi-commit push | `actions/checkout` default `fetch-depth: 1` omits base commit | Set `fetch-depth: 0` on checkout step | `.github/workflows/ci.yml` |
| KI-012 | CI: Node.js deprecation warnings | GitHub Actions using Node 20 (deprecated) | Upgrade to `actions/checkout@v6`, `actions/setup-node@v6` with `node-version: 24` | `.github/workflows/ci.yml` |
| KI-013 | CI: Font loading warning (Vazirmatn) | Font file in `resources/fonts/` missing on CI | Bundle as Vite asset (`resources/fonts/`) + preload via `Vite::asset()` | `resources/css/fonts.css`, `resources/views/app.blade.php` |
| KI-014 | CI: React Compiler warning | ESLint disable directive causes Compiler bailout | Replace directive with module helper function | `Hooks/use-presence.ts` |
| KI-015 | CI: npm audit vulnerabilities | Transitive dependencies (brace-expansion, postcss, vite) | Patch lockfile surgically; major upgrades deferred if breaking | `package-lock.json` |

### CI-Specific complex bugs

**KI-010 — Inertia page path casing (cross-platform)**
Symptom: `Inertia page component file [Rooms/Show] does not exist` — passes on
Windows, fails on ubuntu-latest CI. Root cause: Inertia's default config uses
`resource_path('js/pages')` (lowercase); the repo stores components under
`resources/js/Pages` (uppercase). Windows NTFS is case-insensitive → matches;
Linux ext4 is case-sensitive → no match. Fix: publish `config/inertia.php` with
`pages.paths = resource_path('js/Pages')` (exact casing). Verify with an
exact-case simulation: the default fails on Linux, the corrected path resolves.

**KI-011 — Gitleaks multi-commit push failure**
Symptom: `failed to scan Git repository error="stderr is not empty"` on
multi-commit pushes only. Root cause: gitleaks scans
`--log-opts=baseRef^..headRef` when refs differ; `actions/checkout` default
`fetch-depth: 1` omits the base commit so the range fails. Single-commit pushes
scan `HEAD` (no range) → pass. Fix: `fetch-depth: 0` on the checkout step.
Verify: `git clone --depth 1` + range-scan reproduces the failure.

### Going forward

Any future confirmed bug fix must add a one-line entry to the table (ID
auto-incrementing from KI-016). CI-specific issues are marked with a `CI:`
prefix in the Symptom column. If the bug is a regression of an existing
row, append to that row instead of creating a new one. Prefer linking a new
row to its TASK.md record rather than inlining prolonged prose — the table
should stay scannable, not become a changelog.

## Checklist

- Reproduced with a focused test before changing code.
- Checked `storage/logs/laravel.log` + Sentry for the exact error.
- Ruled out cache/symlink/queue/rate-limit/SSRF causes first.
- Matched the symptom against the polling timings table.
- Fix verified with the same filtered test that reproduced it.
- Full relevant suite run before considering it done.
