# TamashaRoom — Project Tasks

## Completed

### Core Infrastructure
- [x] Laravel **13** application with Inertia + React (composer.json requires `laravel/framework: ^13.8`; AGENTS.md fixed from "Laravel 12")
- [x] Authentication (login, register, email verification, password reset)
- [x] Profile management (edit, update, destroy)

### Rooms
- [x] Create room with name and max members
- [x] Join room via invite code
- [x] Show room (dashboard listing)
- [x] Delete room (owner only)
- [x] **Rename room** (owner only, via settings dialog)
- [x] **Lock/unlock room** (prevents new joins, owner only)
- [x] **Regenerate invite code** (owner only)
- [x] **Kick member** (owner only, with confirmation)
- [x] **Transfer ownership** (owner only, with confirmation)
- [x] **Room Settings dialog** (rename, lock, invite management)
- [x] **Host controls in Member List** (kick/transfer buttons on hover)
- [x] **Confirmation dialogs** for destructive actions
- [x] **Toast notifications** for user feedback
- [x] Permission enforcement through RoomPolicy

### Playback Sync
- [x] Video URL setting (owner only)
- [x] Play/pause sync with host authority
- [x] Position sync with drift detection
- [x] State versioning with atomic increments
- [x] Playback rate support
- [x] Polling-based sync (3s interval)
- [x] Server timestamp for interpolation
- [x] Video proxy streaming with Range request support

### Chat
- [x] Send messages (polling, 3s)
- [x] Delete own messages — **Backend + frontend complete** (`ChatController@destroy`, `ChatMessagePolicy@delete`, delete button in `RoomChat` with confirm dialog)
- [x] Real-time polling

### Subtitles
- [x] Upload SRT and VTT files
- [x] Server-side SRT→VTT conversion
- [x] Multiple tracks per room
- [x] Active track persisted in localStorage
- [x] Subtitle overlay with cue rendering
- [x] Subtitle settings (bg opacity, position, RTL support)
- [x] Error and loading states

### Presence & Heartbeat
- [x] Online/offline detection via heartbeat (30s interval)
- [x] Socket-independent page unload detection (sendBeacon)
- [x] Timeout detection (90s threshold, scheduled every minute)
- [x] Reconnect with exponential backoff (30s → 60s → … → 5min max)
- [x] Presence-aware member list (green/gray dots, last seen)
- [x] Connection indicator (Wifi/WifiOff)
- [x] Owner crown icon
- [x] Polling-based presence list (5s)

### Scheduled Tasks
- [x] `presence:timeout` — mark stale members offline every minute
- [x] `rooms:prune-inactive` — delete rooms inactive 7+ days
- [x] Queue worker — process jobs one batch at a time

## Testing
- [x] **166** tests across all modules (132 Feature + 34 Unit)
- [x] **102** Frontend tests (79 existing + 23 Zustand store tests)
- [x] Build verification (tsc + vite)

### Security Hardening
- [x] **SSRF Protection** — `UrlSecurityService` with DNS resolution, private IP blocking (RFC 1918, loopback, link-local, CGNAT), localhost hostname blocking, DNS rebinding protection
- [x] **File Upload Hardening** — MIME content verification in `UploadSubtitleRequest` (`after()` validation hook), format detection (SRT: numeric first line, VTT: WEBVTT header), rejects renamed executables and script injection
- [x] **Security Headers Middleware** — `Content-Security-Policy` (restrictive), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (all disabled), `Strict-Transport-Security` (production only), removed `X-Powered-By` and `Server` headers
- [x] **Rate Limiting** — Login (5/min per email+IP), Chat (30/min), Playback (60/min), Video Proxy (30/min), Presence (60/min) via named rate limiters in `AppServiceProvider`
- [x] **Auth Audit** — `PlaybackController::update` and `setVideo` now use `$this->authorize()` with existing policies instead of manual user ID checks
- [x] **Info Leakage** — Production error handler returns `{'message': 'Server Error'}` for non-HTTP exceptions, debug info hidden when `APP_DEBUG=false`
- [x] **Comprehensive Tests** — `SecurityTest` (18 feature tests: headers, MIME validation, auth consistency, access control, info leakage), `UrlSecurityServiceTest` (15 unit tests: SSRF scenarios including IP ranges, hostname patterns, URL formats)

### Audit Fixes (2026-07-21)
- [x] **Critical: DeleteRoomAction wrapped in DB::transaction** — disk file deletion stays outside; DB rows are atomic
- [x] **Critical: Prune query no longer deletes freshly-created rooms** — `store()` sets `last_activity_at = now()`; `orWhereNull` removed from prune query
- [x] **Index on rooms.last_activity_at** — new migration, mitigates cap-check and prune query scans
- [x] **PlaybackMode backed enum** — `App\Enums\PlaybackMode` with `Direct`/`Proxy` cases; Room model cast; Action return type; TS union stays synchronized
- [x] **RTL fix** — `mr-auto` → `me-auto` in member-list.tsx
- [x] **Join rate limiter** — 10/min per user/IP on the join route
- [x] **Persian error messages** — room cap ("سرور در حال حاضر ظرفیت کامل دارد"), join rejection via `Response::deny()` ("این اتاق پر است", "این اتاق قفل شده است")
- [x] **Accessibility** — `aria-label` on toast dismiss button; removed redundant `useEffect` focus (now uses native `autoFocus`)
- [x] **Test stability** — `Carbon::setTestNow()` in time-sensitive prune tests
- [x] **Race condition coverage** — atomic join path test verifying `lockForUpdate()` guard
- [x] **Cleanup** — deleted stray root-level `TASK.md`; `TAMASHAROOM_MAX_CONCURRENT_ROOMS` added to `.env.example`; `docs/PROJECT.md` "Current Status" updated

### Documentation & Dependency Cleanup (2026-07-22)
- [x] **AGENTS.md** — Radix → Headless UI, Pest → PHPUnit in Stack and Commands
- [x] **PROJECT.md** — same Radix/Pest fixes across tech table, directory tree, scripts, and changelog; added 2026-07-22 changelog entry
- [x] **SYSTEM.md** — Radix → Headless UI in component guide, focus trap examples, file structure comment, and primitive rule
- [x] **TASK.md** — Pest → PHPUnit in CI description; CI runs updated
- [x] **composer.json** — removed stale `pestphp/pest-plugin` from `allow-plugins`
- [x] **package.json** — removed unused `zod-validation-error`; added `zod`, `zustand`, `vitest`, `prettier`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; added `type-check`, `format`, `format:check`, `test`, `test:watch`, `test:e2e` scripts
- [x] **laravel/sanctum** — installed, config published, migration run
- [x] **vitest.config.ts** — created with jsdom, `@/` alias, React plugin, setup file
- [x] **tests/e2e/playwright.config.ts** — created scaffolding (mirrors a11y config)
- [x] **Frontend tests** — 15 unit tests for `computeExpectedPosition`, `toPlaybackState`, and `usePlaybackSync` (drift detection, state versioning, debounce, error handling, host authority, `onRemoteChange` callback)

### Zustand Store Migration (2026-07-22)
- [x] **Zustand stores created** — `resources/js/stores/theme.ts`, `room-ui.ts`, `subtitle.ts`
- [x] **Theme store** — dark mode toggle; replaces `useState<boolean>` in AppLayout.tsx
- [x] **Room UI store** — active tab, modal visibilities, video URL, room name, invite code, is_locked; replaces 14 `useState` calls in Pages/Rooms/Show.tsx
- [x] **Subtitle store** — subtitle settings with localStorage persistence; replaces `useSubtitleSettings` hook in subtitle-overlay.tsx
- [x] **All components wired** — AppLayout, Rooms/Show, subtitle-overlay, subtitle-settings consume Zustand stores directly
- [x] **Lint pass** — ESLint warnings reduced from 5→3; Show.tsx useEffect deps completed; unused `SubtitlePosition` import removed

### Playwright E2E & A11y Tests (2026-07-22)
- [x] **Test helper routes** — `routes/test-helpers.php` loaded in `local`/`testing` env; provides `POST /__test/setup-verified-room` (creates user + room, logs in) and `POST /__test/join-room` (creates verified member in existing room)
- [x] **A11y test for room page** — `tests/a11y/room-a11y.spec.ts` navigates to a room and runs axe (wcag2a/wcag2aa/wcag21a/wcag21aa/best-practice); filters critical+serious violations
- [x] **E2E tests** — `tests/e2e/room.spec.ts`:
  - Host can create a room and see the room page
  - Guest joins room via invite code (two browser contexts)
  - Playback state propagates from host to guest (set video URL + patch is_playing → poll until guest sees it)
- [x] **Playwright configs cross-platform** — removed `channel: "chrome"` from both a11y and e2e configs; uses bundled Chromium

### CI Pipeline Update (2026-07-22)
- [x] **`.github/workflows/ci.yml`** — added steps:
  - `npm run test` (Vitest frontend unit tests)
  - `npx playwright install chromium` (install test browser)
  - `npm run test:a11y` (Playwright a11y, `APP_ENV=local`)
  - `npm run test:e2e` (Playwright E2E, `APP_ENV=local`)

### CI Fix: Missing APP_KEY (2026-07-25)
- [x] **`.github/workflows/ci.yml`** — added `php artisan key:generate` step after environment file creation, before running any tests or PHP commands that require an application key

### A11y Fixes — First Green Run (2026-07-25)
- [x] **AppLayout logout nested-interactive** — removed `<Link as="button">` wrapper, used `router.post()` directly on `<Button>` with `aria-label="خروج"`
- [x] **AuthenticatedLayout logo aria-label** — added `aria-label="خانه"` to home/logo `<Link>`
- [x] **Dashboard card copy-link contrast (1.79:1)** — `text-primary` → `text-muted-foreground hover:text-primary`
- [x] **Tab nav contrast (3.89:1 → ~6:1)** — darkened light-mode `--muted-foreground` from `30,8%,40%` to `30,12%,26%`
- [x] **Chat timestamp opacity** — replaced `opacity-60` with conditional `text-primary-foreground/80` / `text-secondary-foreground/80`
- [x] **Toast close button, track extension label** — `opacity-60` → `opacity-80` on remaining text elements

### Documentation & Security Cleanup (2026-07-22)
- [x] **PROJECT.md tech stack** — Vite 6→5, Zod 3→4, Vitest 2→3; React Query line removed (not installed); removed `test:ui` script (doesn't exist in package.json)
- [x] **PROJECT.md SYSTEM.docx references** — all 9 occurrences changed to `SYSTEM.md`
- [x] **PROJECT.md directory structure** — rebuilt from actual disk listing: added `Actions/`, `Enums/`, `Providers/`, `Services/`, `Hooks/` (uppercase), `types/`, `__tests__/`, `Pages/Auth/`, `Pages/Profile/`; removed `Api/`, `Resources/`, `layout/`, `images/`; fixed `hooks/`→`Hooks/` (case-sensitive Linux compat); added actual file listings
- [x] **PROJECT.md public/ section** — removed `images/` and `sitemap.xml` (don't exist on disk)
- [x] **`.opencode/skills/component-architecture/SKILL.md:42`** — Radix→Headless UI
- [x] **`.opencode/skills/component-architecture/SKILL.md` CVA section** — replaced with `cn()` pattern (matches actual usage — `clsx` is installed, CVA is not)
- [x] **SYSTEM.md section 15.05** — entire CVA section replaced with `cn()`/`clsx`-based variant guidance; all CVA import examples removed
- [x] **SYSTEM.md button template** — replaced CVA-based example with `cn()`-based equivalent (variant classes via `Record<string, string>`)
- [x] **`README.md`** — replaced default Laravel scaffolding with TamashaRoom overview, setup instructions, and quality commands
- [x] **`VideoProxyService`** — added SSL verification disable rationale comment to all three `stream_context_create` blocks (`fetchHead`, `handleRangeRequest`, `handleFullRequest`)
- [x] **`docs/TASK.md`** — marked all completed items; added SSRF TOCTOU entry to Accepted MVP Limitations; updated test counts; updated Chat section (delete button now complete); removed completed items from Future Features

### Comprehensive Audit (2026-07-22)
- [x] **Feature completeness verified** — 44 of 46 items confirmed implemented end-to-end. 2 partial items documented below.
- [x] **Test coverage surveyed** — 116 Feature tests + 32 Unit tests (both **~3x higher** than documented). 15 Vitest tests match. E2E and a11y tests exist but are thin; chat has zero tests at any layer.
- [x] **Documentation inconsistencies found and catalogued** — 20+ issues across PROJECT.md, SYSTEM.md, AGENTS.md, and the skill file.
- [x] **Security posture verified** — All 7 hardening items confirmed intact. SSRF protects all 5 RFC 1918 ranges + CGNAT + IPv6. CSP has nonce-based production mode. CSRF exception scoped strictly to `__test/*`. Test-helper routes double-gated (file-load + handler-level). Minor note on VideoProxyService SSL verification disabled.
- [x] **Deployment readiness assessed** — No production steps have been executed. All 4 items (migrations, storage:link, queue worker, cron) are still pending.
- [x] **Tech debt and gaps catalogued** — See Pending and Future Features sections below.

### Items That Need Attention (from audit)

#### Features
- [x] **Delete own messages — no UI** (`room-chat.tsx` lacked delete button; added with ConfirmDialog)
- [x] **Frontend component tests** — 64 tests added across 6 files (room-chat, member-list, video-player, subtitle-overlay, subtitle-settings, subtitle-parser)
- [x] **Rate limiting** — 7 tests exercising all 5 rate limiters (login, chat, playback, proxy, presence)
- [x] **VideoProxyService SSL verification disabled** — documented with rationale comment on all three stream contexts
- [x] **Dashboard a11y test un-skipped** — now uses `GET /__test/setup-verified-room` to create a verified user and login, bypassing the email-verification redirect
- [x] **SRT format detection tightened** — now validates the SRT timing line format (`HH:MM:SS,mmm --> HH:MM:SS,mmm`) on the second non-empty line
#### Documentation vs. Code Mismatches
- [x] **PROJECT.md tech stack** — Vite 6→5, Zod 3→4, Vitest 2→3; React Query removed (not installed)
- [x] **PROJECT.md** — nine `SYSTEM.docx` references changed to `SYSTEM.md`
- [x] **PROJECT.md directory structure** — aligned with actual disk (added Actions, Enums, Providers, Services, Hooks, types, __tests__; removed Api/, Resources/, layout/, images/; fixed `hooks/`→`Hooks/`)
- [x] **`.opencode/skills/component-architecture/SKILL.md`** — Radix→Headless UI; CVA→`cn()` pattern
- [x] **SYSTEM.md section 15.05** — replaced CVA examples with `cn()`/`clsx` pattern; removed `class-variance-authority` import
- [x] **`README.md`** — replaced default Laravel scaffolding with TamashaRoom project description
- [x] **`VideoProxyService`** — added SSL verification disable rationale comment to all three stream contexts
- [x] **`.env.example`** — added `SESSION_SECURE_COOKIE=true`, changed `APP_LOCALE=en`→`fa`, changed `APP_NAME=Laravel`→`TamashaRoom`
- [x] **`resources/js/Hooks/` casing** — directory is `Hooks/` (uppercase), PROJECT.md already shows `Hooks/`; no lowercase `hooks/` directory exists separately

#### Test Coverage Gaps
- [x] **Chat endpoints** — 10 Feature tests added (send, list, delete, auth, validation)
- [x] **Frontend components** — 64 component tests added across 6 files
- [x] **Rate limiting** — 7 Feature tests added (login, chat, playback, proxy, presence)
- [x] **Zustand stores** — 23 tests added: theme (5), room-ui (11), subtitle (7)
- [x] **Dashboard a11y test** — un-skipped (uses `__test/setup-verified-room` helper)
- [ ] **Profile, password-reset, verify-email a11y** — pages uncovered
- [ ] **E2E tests** — only 3 tests covering room creation/join/propagation; chat, subtitle, lock/kick, transfer flows untested at E2E level
- [ ] **Subtitle content sanitization** — no explicit XSS/content sanitization; relies on browser's VTT-safe rendering

#### Deployment Readiness
- [ ] **Migrations on production** — not executed (all 13 migrations have run only on local SQLite)
- [ ] **`storage:link`** — symlink does not exist (`public/storage` missing); subtitle uploads depend on it
- [ ] **Queue worker in production** — configured (`QUEUE_CONNECTION=database`) but not running on any production host
- [ ] **cPanel cron for `schedule:run`** — not added
- [ ] **`SESSION_SECURE_COOKIE`** — not in `.env` or `.env.example`; default `null` means no HTTPS enforcement
- [ ] **`APP_DEBUG=false`** — must be confirmed on production; currently `true` in local `.env`
- [ ] **`APP_ENV=production`** — must be set on production; currently `local`

## Pending

### Deployment
- [ ] Run migrations on production database
- [ ] Create `public/storage` symlink (`php artisan storage:link`); verify subtitle files reachable through it
- [ ] Configure queue worker for production (confirm `QUEUE_CONNECTION=database` + supervisor/loop script)
- [ ] Set up cPanel cron entry for `* * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1`
- [ ] Confirm `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true` in production `.env`
- [ ] Add `SESSION_SECURE_COOKIE=true` to `.env.example` so it's not forgotten on next environment setup

### Launch Blockers (single-core budget — SYSTEM.md 21.10)
- [x] **Enforce per-room member cap at join time**, including a `lockForUpdate()` guard against a join race on the last slot — `JoinRoomRequest` validates invite code; `RoomController@join` uses `DB::transaction` + `lockForUpdate()`; policy checks `isFull()` inside the locked transaction
- [x] **Enforce a system-wide active-room cap** — `config/tamasharoom.php` (`max_concurrent_rooms`, default 50); `StoreRoomRequest::after()` checks active room count on creation; user-facing validation error on reject
- [x] **Extend `rooms:prune-inactive`** to delete subtitle files from disk, subtitle tracks, chat messages, and members alongside the room row — uses `DeleteRoomAction` with `chunkById` for memory-safe pruning
- [x] **Ensure the owner-initiated "Delete room" path** uses the same cleanup logic — `RoomController@destroy` now uses `DeleteRoomAction`
- [x] **Implement `DetermineVideoPlaybackModeAction`** — SSRF-safe HEAD check; returns `'direct'` when source has CORS `*` + `Accept-Ranges: bytes`; falls back to `'proxy'`; stored on room row; frontend `VideoPlayer` reads `playback_mode` to choose direct or proxy source
- [x] **Add production error monitoring (Sentry)** — `sentry/sentry-laravel` v4.27 installed; `config/sentry.php` published; `.env.example` has `SENTRY_DSN` placeholder; disabled when DSN is empty

### Future Features
- [ ] Room ownership transfer UX polish (update member list after transfer)
- [ ] WebSocket migration for real-time events
- [ ] Chat/room moderation — report message, owner can delete any message (not just their own)
- [ ] Cover profile, password-reset, verify-email pages with a11y audits
- [ ] E2E tests for chat, subtitle, lock/kick, and transfer flows

### Accepted MVP Limitations (tech debt)
- [ ] **SSRF TOCTOU gap** — `UrlSecurityService::validateVideoUrl()` runs DNS resolution and IP checks once at the top of `VideoProxyService::stream()`. Within a single request, a DNS rebinding attack could pass validation for a safe IP and then resolve to a different (internal) IP by the time `get_headers()` or `fopen()` runs. The window is microseconds and the proxy requires authentication, so the risk is accepted for MVP. Post-MVP fix: resolve the hostname synchronously, compare the resolved IP against the blocklist inside every stream context (as a `stream_context_set_param` wrapper), and fail on mismatch.
