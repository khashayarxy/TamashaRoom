# PROJECT_BASELINE.md

> **⚠️ HISTORICAL VERIFICATION EVIDENCE — MAY BE STALE.**
>
> This file was compiled as verification evidence (level 4 of the source-of-truth
> hierarchy) and is **not** a live reference. Its test counts, feature lists, and
> confidence markers were verified as of **2026-08-02** and have since drifted:
> - Test counts in §Testing (202/122/12) predate Phase 13/14 and the 2026-08-04
>   audit-fix batches. The **canonical current counts live in `docs/TASK.md`**
>   (backend 240, frontend 203, E2E 14, a11y 11 as of 2026-08-04).
> - Features added in Phase 13 (room-default subtitles) and Phase 14 (presence
>   moments, watch-again/replay) are not listed here.
>
> Do not treat stale figures as current facts. For the current state, read the
> canonical docs instead: `docs/TASK.md`, `docs/PROJECT.md`,
> `docs/deployment-checklist.md`, `docs/SYSTEM.md`.
>
> Confidence levels (used in this historical file):

> - **Confirmed** — directly supported by the repository source or a documented,
>   verified test result.
> - **Partially confirmed** — supported by documentation but not fully re-verified
>   against the source during compilation, or supported with minor discrepancies.
> - **Not verified** — mentioned in materials but not supported by anything I could
>   confirm from the repository during this pass.
>
> **Source of truth:** This file is level 4 of the source-of-truth hierarchy
> (AI-maintained docs). If it conflicts with the source code (level 1), executable
> tests (level 2), or the canonical docs `docs/SYSTEM.md`, `docs/PROJECT.md`,
> `docs/TASK.md` (level 3), the higher level wins and this file needs a correction.
> See `README.md` → "Source-of-Truth Hierarchy".

---

## Project Overview

**Name**: TamashaRoom (تماشاروم)

**Purpose**: A synchronized watch-party platform for Persian-speaking users. Users
create a private room, share an invite link, and everyone in the room watches an
external video together with playback kept in sync (play, pause, seek, position).

**Primary language**: Persian (Farsi), RTL. This is the only MVP language — RTL is
the default, not an overlay.

**Video model**: External video links only. No video files are stored on the
server; only playback state, chat, subtitles, and membership are stored.

**Deployment target**: Shared cPanel hosting — Apache, PHP 8.4, MySQL/MariaDB,
2GB RAM, 1 CPU core, 20GB storage. No Docker, no Redis, no WebSockets, no
persistent background workers, no root access. [Confirmed — docs/PROJECT.md,
docs/SYSTEM.md ch. 18.00]

## Technology Stack

| Layer | Technology | Version | Status |
|---|---|---|---|
| Backend framework | Laravel | 13.20.0 (^13.8) | Confirmed — composer.json |
| Backend language | PHP | 8.4 | Confirmed — composer.json, docs/PROJECT.md |
| Frontend bridge | Inertia.js | `@inertiajs/react` 2.x (client) + `inertiajs/inertia-laravel` 3.1.x (server) | Confirmed — package.json, composer.json, docs/PROJECT.md |
| Frontend framework | React | 19.x | Confirmed |
| Frontend language | TypeScript | 5.x, strict mode | Confirmed |
| Build tool | Vite | 5.x | Confirmed (docs/PROJECT.md lists 5.x; noted that one doc entry said 6 then was corrected to 5) |
| Compiler | React Compiler | stable (via Vite React plugin) | Confirmed |
| Styling | Tailwind CSS | 4.x | Confirmed |
| UI components | Headless UI (@headlessui/react) | 2.x | Confirmed |
| Client state | Zustand | 5.x | Confirmed — UI state only |
| Forms | Inertia `useForm` | built-in | Confirmed |
| Server validation | Laravel Form Requests | built-in | Confirmed |
| Client validation | Zod | 4.x | Confirmed |
| Backend tests | PHPUnit | 12.x | Confirmed |
| Frontend unit tests | Vitest | 3.x | Confirmed |
| Component tests | React Testing Library | 16.x | Confirmed |
| E2E tests | Playwright | 1.x | Confirmed |
| A11y audits | @axe-core/playwright | latest | Confirmed |
| JS/TS lint | ESLint | 9.x, flat config | Confirmed |
| PHP lint | Laravel Pint | latest | Confirmed |
| Formatting | Prettier | 3.x | Confirmed |
| Auth for external consumers | Laravel Sanctum | latest | Confirmed — installed, published, migration run |
| Error monitoring | Sentry (`sentry/sentry-laravel`) | v4.27 | Confirmed — disabled when SENTRY_DSN empty |
| Real-time (planned, post-MVP) | Laravel Reverb + Echo | — | Not verified — documented as planned, explicitly NOT installed for MVP |

## Backend

- Framework: Laravel 13, PHP 8.4. [Confirmed]
- Auth: Laravel's built-in session guard for the app's own UI; Sanctum tokens for
  external API consumers. Session driver is `database`. [Confirmed — docs/SYSTEM.md
  ch. 18.09]
- Architecture: Controllers own data fetching; pages are presentational. Business
  logic lives in Actions/Services, not controllers. [Confirmed]
- Key directories: `app/Actions`, `app/Console/Commands`, `app/Enums`,
  `app/Events`, `app/Http/Controllers`, `app/Http/Middleware`,
  `app/Http/Requests`, `app/Models`, `app/Policies`, `app/Services`.
  [Confirmed — directory listing]
- Scheduled tasks: `PruneInactiveRooms` (daily, 7-day inactivity),
  `presence:timeout` (every minute, 90s stale threshold), plus a `queue:work
  --stop-when-empty` batch processor scheduled every minute. [Confirmed —
  routes/console.php]
- Rate limiting: named limiters for login (5/min per email+IP), register
  (5/min per IP), forgot-password (5/min per email+IP), reset-password (5/min
  per IP), chat (30/min), playback (60/min), video proxy (30/min), presence
  (60/min), join (10/min).
  [Confirmed — docs/TASK.md, FRONTEND_CONTRACT.md]

## Frontend

- React 19 + TypeScript (strict) + Tailwind CSS 4 + Zustand. [Confirmed]
- Pages under `resources/js/Pages`; components under `resources/js/Components`
  split into `composite/` (domain) and `ui/` (primitives); hooks under
  `resources/js/Hooks`; stores under `resources/js/stores`.
  [Confirmed — directory listing]
- State rules: Inertia props are server-owned data; Zustand holds local UI state
  only. The one documented exception is the Room page, where selected server data
  (video_url, room_name, invite_code, is_locked) is copied into the `room-ui`
  store to avoid prop drilling. [Confirmed — docs/SYSTEM.md ch. 16.03]
- Three Zustand stores exist: `theme`, `room-ui`, `subtitle`. [Confirmed —
  resources/js/stores listing] `theme` holds the dark/light toggle (localStorage);
  `room-ui` holds Room-page UI state incl. the reactive `ownerId` (see
  use-room-ownership); `subtitle` holds subtitle settings (localStorage). No
  `sidebar` store exists.
- Legacy Breeze components coexist with the newer `ui/` primitives (e.g.
  `PrimaryButton`, `TextInput` alongside `button`, `input`).
  [Partially confirmed — quality-report.md §5 lists both]

## Database

- MySQL/MariaDB in production; SQLite for local dev and tests. [Confirmed]
- 14 migration files total (3 framework base + 11 application), including:
  users, rooms, room_members, chat_messages, subtitle_tracks,
  personal_access_tokens, cache, jobs, plus application migrations for
  playback_state_version, presence fields, is_locked, playback_mode, a
  last_activity_at index, and active_subtitle_track_id on rooms.
  [Confirmed — database/migrations listing]
- Key tables and relationships:
  - `users` ← owner of `rooms` (user_id), author of `chat_messages`, member via `room_members`
  - `rooms` — has many `room_members`, `chat_messages`, `subtitle_tracks`
  - `room_members` — belongs to `room` and `user`; carries presence fields
  - `chat_messages` — belongs to `room` and `user`
  - `subtitle_tracks` — belongs to `room` and `user`; stores file path
- Room playback fields on `rooms`: video_url, playback_mode, is_playing,
  position_seconds, duration_seconds, playback_rate, state_version,
  server_timestamp, last_activity_at, is_locked, max_members.
  [Confirmed — app/Models/Room.php]

## Authentication

- Session-based auth for the app's own UI (Laravel default guards); session driver
  `database`. [Confirmed]
- Email verification is enabled; dashboard and room routes require `verified`.
  [Confirmed — FRONTEND_CONTRACT.md §6.4]
- Password reset flow implemented (forgot/reset pages). [Confirmed]
- Sanctum tokens for `routes/api.php` external consumers. [Confirmed]
- Password hashing via the `'hashed'` cast; the `Hash::make()` call was removed
  from the registration controller to avoid double-hashing. [Confirmed —
  quality-report.md §4.3, docs/TASK.md]

## Authorization

- Policies: `RoomPolicy`, `ChatMessagePolicy`. [Confirmed — app/Policies]
- Room ownership is determined by comparing `user_id` to `room.user_id`; there is
  no `role` column. [Confirmed — FRONTEND_CONTRACT.md §3.3]
- Owner-only actions: room update/delete, lock/unlock, kick, transfer ownership,
  set video URL, update playback state. [Confirmed — FRONTEND_CONTRACT.md]
- Member-level access: room state, chat, subtitles, presence, proxy.
  [Confirmed — FRONTEND_CONTRACT.md §1.2]
- Unauthorized resource access returns 404 (not 403) to avoid existence leakage.
  [Confirmed — docs/SYSTEM.md ch. 18.09]
- `is_owner` is computed and appended to `RoomMember` serialization.
  [Confirmed — app/Models/RoomMember.php]

## Video System

- Video URL set by room owner via `POST /playback/{room}/set-video`.
  [Confirmed]
- Playback mode determination: `DetermineVideoPlaybackModeAction` performs an
  SSRF-safe HEAD check; if the source supports CORS `*` + `Accept-Ranges: bytes`
  it uses `'direct'`, otherwise `'proxy'`. Stored on the room row.
  [Confirmed — docs/TASK.md, FRONTEND_CONTRACT.md §7.1]
- Playback fields synchronized: is_playing, position_seconds, duration_seconds,
  playback_rate, video_url, state_version, server_timestamp. [Confirmed]

## Video Proxy

- `VideoProxyService` streams external video through the server when direct
  playback is not possible. [Confirmed]
- `GET /proxy/video/{room}` endpoint, rate limited (30/min). [Confirmed]
- Range request support (streaming/seek). [Confirmed — docs/TASK.md]
- Supported MIME types: mp4, webm, ogg, mkv, mov, avi, m3u8, ts. [Confirmed —
  FRONTEND_CONTRACT.md §7.12]
- TLS certificate and peer verification are enabled on the proxy's stream
  contexts (`verify_peer=true`, `verify_peer_name=true`); TLS is never disabled.
  [Confirmed — app/Services/VideoProxyService.php createStreamContext()]

## Playback Synchronization

- No WebSockets. Playback state changes are written as a Laravel broadcastable
  Event (`PlaybackStateChanged`), and the frontend polls for the state.
  [Confirmed]
- Polling: 3s while playing, 10s while paused. [Confirmed — FRONTEND_CONTRACT.md]
- Drift compensation: client computes expected position as
  `position + (now - serverTimestamp) * playbackRate`; the video element's
  currentTime is corrected when drift exceeds 2 seconds. [Confirmed]
- Optimistic concurrency via `state_version` (client ignores stale responses).
  [Confirmed]
- `BROADCAST_CONNECTION=log` today; transport is swappable to Reverb later without
  a feature rewrite. [Confirmed — docs/PROJECT.md, docs/SYSTEM.md ch. 18.05]

## Chat

- Simple in-room chat, polling-based (3s). [Confirmed]
- Send, list (last 50, oldest-first), and delete own messages.
  [Confirmed — FRONTEND_CONTRACT.md]
- Message delete authorization: author only via `ChatMessagePolicy`. [Confirmed]

## Presence

- Heartbeat endpoint (`POST /presence/{room}/heartbeat`) every 30s with
  exponential backoff (30s → up to 5min max). [Confirmed]
- Page-unload detection via `navigator.sendBeacon` on `beforeunload`.
  [Confirmed]
- Stale timeout: 90s without heartbeat → marked offline by scheduled
  `presence:timeout` task (every minute). [Confirmed]
- Presence member list polling at 5s. [Confirmed]
- Presence-aware member list (green/gray dots, last seen), connection indicator,
  owner crown icon. [Confirmed — docs/TASK.md]

## Room Management

- Create room with name + max_members (default 10, min 2, max 50). [Confirmed]
- Join via 12-char invite code; join rate limit 10/min. [Confirmed]
- Room lock/unlock (prevents new joins), regenerate invite code. [Confirmed]
- Kick member and transfer ownership (owner only, with confirmation dialogs).
  [Confirmed]
- Delete room (owner only) via shared `DeleteRoomAction` (transactional cleanup of
  members, chat, subtitles, and subtitle files from disk). [Confirmed]
- Per-room member cap with `lockForUpdate()` race guard. [Confirmed]
- System-wide active-room cap via `config/tamasharoom.php`
  (`max_concurrent_rooms`, default 50). [Confirmed — config/tamasharoom.php]

## Subtitle System

- Upload SRT and VTT subtitle files (max 2048 KB). [Confirmed]
- Server-side SRT→VTT conversion via `SubtitleConverterService`. [Confirmed]
- Content-based validation: SRT timing format check + VTT WEBVTT header check in
  `UploadSubtitleRequest` (`after()` hook). [Confirmed]
- Multiple tracks per room; active track persisted in localStorage. [Confirmed]
- Subtitle overlay with cue rendering; settings for bg opacity, position, RTL.
  [Confirmed]
- Cues extracted server-side by `SubtitleConverterService::extractCues()`.
  [Confirmed — FRONTEND_CONTRACT.md §3.6]
- MIME rule: `mimes:srt,vtt,txt` — the `txt` was added because Symfony's
  `guessExtension()` guesses SRT content as `txt`. [Confirmed — docs/TASK.md]

## Storage

- Default filesystem disk is `local`; subtitle files stored under
  `storage/app/public/subtitles`. [Partially confirmed — docs/TASK.md and
  deployment-checklist reference `storage/app/public/subtitles`]
- `storage:link` symlink (`public/storage`) is required but does not yet exist in
  production. [Confirmed — docs/TASK.md "Deployment Readiness"]
- Queue/cache/session all use database drivers (no Redis). [Confirmed]
- Production file retention: subtitle files accumulate; pruning is tied to room
  deletion (7-day inactivity). [Confirmed]

## Testing

- Backend: **202** tests (168 Feature + 34 Unit) — PHPUnit. [Confirmed — source-level
  recount 2026-08-02: 202 static `#[Test]`/`test_*` declarations counted recursively
  across `tests/Feature` (incl. the 18-test `tests/Feature/Auth/` suite and the
  15-test `RateLimiterTest`) and
  `tests/Unit`; `php artisan test` runs 202 and passes 202. No data providers, so
  static declaration count = runtime count. Baseline was 194 (160 Feature + 34 Unit)
  before the Authentication Rate-Limit Hardening batch added 8 tests.]
- Frontend: **122** tests (99 component/hook/logic + 23 Zustand store tests: theme 5,
  room-ui 11, subtitle 7) — Vitest. [Confirmed — source-level recount 2026-08-02:
  122 static `it()`/`test()` declarations counted in `resources/js/__tests__/`;
  `npm run test` runs 122 and passes 122. No `it.each`/`test.each` parameterized
  tests, so static declaration count = runtime count.]
- E2E: **12** tests passing (chat 2/2, lock-kick-transfer 4/4, room 3/3, subtitle
  3/3) — Playwright. [Confirmed — test run 2026-08-02]
- A11y: axe-based Playwright tests; **11/11** pass (welcome, login, register,
  dashboard, forgot-password, verify-email, profile, reset-password,
  confirm-password, profile delete-account modal, room). [Confirmed — test run
  on 2026-08-02]
- Known coverage gaps: subtitle content sanitization now has explicit XSS tests
  (Batch 2B, TAM-003); Profile, password-reset, verify-email a11y pages are now
  covered by axe (Batch 2D, TAM-004). No remaining a11y coverage gaps.
- CI pipeline (GitHub Actions): PHP 8.4, Node 22, PHPUnit on SQLite `:memory:`,
  Pint, ESLint, TypeScript, Vite build, Vitest, Playwright a11y + E2E.
  [Confirmed — .github/workflows/ci.yml]

## Deployment

- Target: shared cPanel (Apache, PHP 8.4, MySQL). No Docker, Redis, WebSockets,
  or persistent workers. [Confirmed]
- The single cron entry runs `php artisan schedule:run` every minute; all
  scheduling lives in `routes/console.php`. [Confirmed]
- Queue worker runs as a scheduled `queue:work --stop-when-empty --max-time=30`
  batch every minute, per `routes/console.php`. No persistent worker or wrapper
  script runs — queue draining is handled by the single `schedule:run` cron
  entry. [Confirmed — routes/console.php]
- Optimization commands: `config:cache`, `route:cache`, `view:cache`,
  `event:cache` on deploy. [Confirmed — docs/SYSTEM.md ch. 18.03]
- Sentry DSN optional; disabled when empty. [Confirmed]

## Current Constraints

- **Shared-hosting budget**: 1 CPU core, 2GB RAM, 20GB storage. [Confirmed]
- No Docker, no Redis, no WebSockets, no persistent background workers, no root
  access. [Confirmed]
- No feature may assume infrastructure the hosting does not provide. [Confirmed]
- Playback sync is delivered by polling (3s), not push. [Confirmed]
- Everything is Persian/RTL; dark mode is the default. [Confirmed]
- Strict TypeScript; no `any` without documented reason. [Confirmed]
- Mutation validation follows the endpoint category: structured/user-entered
  input → Form Request (or appropriate validation); simple JSON/action endpoints
  → explicit authorization + appropriate inline/request validation; Inertia
  forms → `useForm`; JSON polling/live-room actions → the existing axios `api`
  pattern. No unvalidated `$request->all()` reaches Eloquent. [Confirmed]

## Known Production Considerations

- **No production deployment has been executed yet.** [Confirmed — docs/TASK.md]
- Production pending: migrations, `storage:link`, the cPanel `schedule:run`
  cron (with its scheduled `queue:work --stop-when-empty --max-time=30` batch
  drain) to be configured/verified, `APP_ENV=production`, `APP_DEBUG=false`,
  `SESSION_SECURE_COOKIE=true`.
  [Confirmed — docs/TASK.md "Deployment Readiness"]
- SSRF TOCTOU gap (accepted MVP limitation): DNS resolution happens once at the
  top of the proxy stream; within a single request a DNS rebinding attack could in
  theory pass validation then resolve to an internal IP. Window is microseconds
  and the proxy requires auth — accepted for MVP. [Confirmed — docs/TASK.md]
- Legacy Breeze components still present alongside newer `ui/` primitives.
  [Partially confirmed]
- Room ownership-transfer UX polish (member list update after transfer):
  **RESOLVED** (Batch 2C, TAM-005) — the `useRoomOwnership` hook derives ownership
  from the reactive `room-ui` store; the old owner loses owner-only controls
  immediately and the new owner adopts ownership from presence data. Historical
  context: this was previously listed as pending before Batch 2C; the backend
  transfer path was complete earlier. [Confirmed — docs/TASK.md Batch 2C entry]
- WebSocket migration planned post-MVP (Reverb) but not built. [Confirmed]

## Unverified / Unknown

- Actual production infra details (exact cPanel provider, domain, PHP selector
  settings) are not in the repository. **Not verified.**
- Whether `public/storage` symlink exists locally (it does not exist in
  production; local state not asserted). **Not verified.**
- Whether `node_modules` and `vendor` versions recorded in quality-report.md
  (622MB/833 packages, etc.) still match the current lockfiles.
  **Not verified.**
- The authoritative design-system document is `design-systems/tamasharoom/DESIGN.md`
  (draft status, colors/typography/numerals/calendar). A root-level or `docs/`
  `DESIGN.md` does **not** exist — PRODUCT.md's bare "DESIGN.md" reference was
  corrected to point to the real path. Not reviewed in detail for this baseline.
  **Partially verified** (path confirmed; content not reviewed).
