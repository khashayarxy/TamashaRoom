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
- [x] **214** PHPUnit tests across all modules (**173 Feature + 41 Unit**) — verified by source-level recount on 2026-08-02: 214 static `#[Test]`/`test_*` declarations counted from `tests/` (recursive, including `tests/Feature/Auth/`), matching the 214 passed by `php artisan test` (703 assertions). No data providers — static count equals runtime count. (This is the **canonical count**; skills reference `docs/TASK.md` rather than hardcoding it.)
- [x] **122** Frontend Vitest tests (**99 component/hook/logic + 23 Zustand store tests**: theme 5, room-ui 11, subtitle 7) — verified by source-level recount on 2026-08-02 (Batch G8): 122 static `it()`/`test()` declarations counted from `resources/js/__tests__/`, matching the 122 passed by `npm run test`. No parameterized (`it.each`/`test.each`) tests — static count equals runtime count.
- [x] **12** Playwright E2E tests passing (chat 2, lock-kick-transfer 4, room 3, subtitle 3) — verified 2026-08-02 (Batch G8)
- [x] **11** axe accessibility tests passing — verified 2026-08-02 (Batch G8)
- [x] Build verification (tsc + vite)

### Security Hardening
- [x] **SSRF Protection** — `UrlSecurityService` with DNS resolution, private IP blocking (RFC 1918, loopback, link-local, CGNAT), localhost hostname blocking, DNS rebinding protection
- [x] **File Upload Hardening** — MIME content verification in `UploadSubtitleRequest` (`after()` validation hook), format detection (SRT: numeric first line, VTT: WEBVTT header), rejects renamed executables and script injection
- [x] **Security Headers Middleware** — `Content-Security-Policy` (restrictive), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (all disabled), `Strict-Transport-Security` (production only), removed `X-Powered-By` and `Server` headers
- [x] **Rate Limiting** — Login (5/min per email+IP), Register (5/min per IP), Forgot-password (5/min per email+IP), Reset-password (5/min per IP), Chat (30/min), Playback (60/min), Video Proxy (30/min), Presence (60/min) via named rate limiters in `AppServiceProvider`
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

### Batch 1 Production Fixes (2026-08-01)
- [x] **Issue 1 — Playback polling stops after first fetch** — `use-playback-sync.ts` only scheduled the poll once from the mount effect; `fetchState` never rescheduled. Rewrote with `fetchStateRef`/`cancelledRef`, `schedulePoll()` now re-scheduled in `finally` after every fetch (success or error), interval switches between `POLL_ACTIVE` (3s, playing) and `POLL_IDLE` (10s, paused), unmount cancels cleanly. `sync` now applies `playback_mode` from the PATCH response (was ignored). Added 6 Vitest cases; all 11 hook tests pass.
- [x] **Issue 2/3 — Proxy redirect SSRF + TLS verification** — `VideoProxyService` previously followed redirects automatically (`follow_location=1`) so `UrlSecurityService` only validated the *original* host, and all three stream contexts disabled TLS verification. Rewrote `fetchHead()` as a manual redirect loop (`MAX_REDIRECTS=5`, per-hop `validateVideoUrl`, loop detection, relative-URL resolution) and added `createStreamContext()` with `follow_location=0`/`max_redirects=0` + `verify_peer=true`/`verify_peer_name=true` for range/full requests. Removed the old SSL-disabled rationale comments. Added 6 tests; all 18 `VideoStreamTest` pass.
- [x] **Issue 4 — Playback update accepts unvalidated `video_url`** — `PlaybackController::update` passed `video_url` straight to `updatePlaybackState` with no SSRF check and no mode recompute. Now injects `UrlSecurityService` + `DetermineVideoPlaybackModeAction`, validates changed URLs (422 on failure), recomputes `playback_mode` only when the URL actually changed (avoids a HEAD per 3s poll), and returns `playback_mode` in the response. Added 5 tests; all 21 `PlaybackSyncTest` pass.
- [x] **Issue 5 — Room activity tracking missing** — chat, playback, presence heartbeat, and join never updated `last_activity_at`. Added `Room::touchActivityIfStale()` (throttled, 300s default) used by chat store + presence heartbeat; join calls `touchActivity()` in-transaction; `updatePlaybackState` now sets `last_activity_at = now()` in the same UPDATE. Added 4 tests (join/chat/heartbeat touch + playback assertion).
- [x] **Issue 6 — Room-cap race (count-then-insert)** — `StoreRoomRequest` counted active rooms then the controller inserted outside any lock; two concurrent creates could both pass the check. `RoomController::store` now acquires `Cache::lock('room-cap', 10)` around count+create (works with array + database cache stores). Added `room_cap_race_is_prevented_by_lock` regression test.
- [x] **Issue 7 — Subtitle files orphaned on account deletion** — `ProfileController::destroy` deleted the user (rooms cascade via FK) but subtitle files stayed on disk. Extracted `DeleteRoomAction::deleteFilesForOwnedRooms()` and call it before `$user->delete()`. Added regression test verifying the file is gone from `Storage::disk('public')`.

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

### E2E All Green — Serializer, Test Helper & Route Binding Fixes (2026-07-25)
- [x] **`is_owner` serializer** — added `$appends = ['is_owner']` + accessor to `RoomMember` model; updated `RoomController::members()` to set `room` relation on each loaded member; hidden `room` from serialization
- [x] **FRONTEND_CONTRACT.md updated** — `RoomMember` interface now documents `is_owner: boolean` (was a docs-vs-reality gap: `PresenceMember` had it but `RoomMember` did not)
- [x] **`__test/join-room`** — changed to log in as the room's current owner if that owner is already a member, instead of always creating a new user. Fixes ownership-transfer test: after transfer, the new owner (original guest) is correctly returned.
- [x] **Kick/transfer route binding** — changed `User $target` to `int $targetId` in both `RoomController::kick()` and `transfer()`. Implicit model binding threw 404 before policy evaluation; now the controller checks authorization first and returns proper 403/404 responses.
- [x] **E2E results**: 12/12 pass (chat 2/2, lock-kick-transfer 4/4, room 3/3, subtitle 3/3). PHPUnit 166/166. Lint + TypeScript + Pint all pass.

### E2E CSRF Fix & SRT MIME Validation Fix (2026-07-25)
- [x] **CSRF root cause**: `page.request.post()` in Playwright sends cookies differently than a real browser, breaking the encrypted `X-XSRF-TOKEN` header flow used by `PreventRequestForgery::getTokenFromRequest()`
- [x] **Fix applied**: `bootstrap/app.php` — `encryptCookies(except: ['XSRF-TOKEN'])` stores the cookie as plaintext; all E2E tests send `_token` form field instead of `X-XSRF-TOKEN` header
- [x] **Playwright baseURL bug**: `browser.newContext()` does NOT inherit `baseURL` from config — fixed by passing `{ baseURL: "http://127.0.0.1:8000" }` to all `newContext()` calls
- [x] **SRT MIME validation fix**: `mimes:srt,vtt` in `UploadSubtitleRequest` uses Symfony's `guessExtension()` on file **content**, not the filename. SRT content (starting with sequence number `1`) is guessed as extension `txt`, so `mimes:srt,vtt` fails for all SRT files. Changed to `mimes:srt,vtt,txt` — added `txt` since that's what Symfony's guesser returns for SRT content. The `after()` hook still validates actual content format, rejecting non-subtitle text files.
- [x] **E2E results**: 9/12 pass (chat 2/2, room 3/3, subtitle 3/3, lock-kick-transfer 1/4). Backend: 166/166 pass. Lint + TypeScript + Pint all pass.
- [x] **3 remaining failures diagnosed** (lock-kick-transfer): all caused by missing `is_owner` field in member API response — see Pending section

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
- [x] **`docs/deployment-checklist.md`** — aligned with codebase: `CACHE_DRIVER`→`CACHE_STORE=database` (Laravel 13 var; obsolete name removed repo-wide), `SESSION_DRIVER=database` (was "file or database"), corrected the queue-worker section (was persistent python wrapper + VPS systemd — replaced with scheduler-batch drain per `routes/console.php`), fixed the 13-migration composition list, corrected `npm ci --production`→`npm ci`, added `composer install --no-dev --optimize-autoloader`, documented `public/` web root + `public/build` assets, corrected the `queue:status` verify step
- [x] **`docs/deployment-checklist.md` (Batch 2A.1 verification fixes)** — Section 5 now verifies all 3 scheduled tasks (presence:timeout, rooms:prune-inactive --days=7, queue:work --stop-when-empty --max-time=30); `key:generate --force` made explicitly conditional (new install only, never regen existing production APP_KEY); generic `migrate:rollback` guidance replaced with restore-backup-or-reviewed-corrective-migration; Node build workflow clarified as off-server buildable (cPanel only needs `public/build/`)
- [x] **`useRoomOwnership` hook (Batch 2C, TAM-005)** — ownership was computed from the immutable `room.user_id` Inertia prop in `Show.tsx`, so after a transfer the old owner kept owner-only controls and the new owner never gained them until reload. Added `resources/js/Hooks/use-room-ownership.ts`: `isOwner`/`ownerId` derive from the reactive `room-ui` store `ownerId` (with prop fallback), presence data (which carries `is_owner` from `PresenceService`) syncs the new owner in, a 10s cooldown prevents a stale presence poll from reverting a just-performed transfer, and `transferOwnership` updates the store. `Show.tsx` now uses the hook (controls at `canControl`/set-video/subtitle gate on the reactive value). 5 hook tests + 1 member-list failure-path test (failed transfer never calls `onTransfer`)

#### Test Coverage Gaps
- [x] **Chat endpoints** — 10 Feature tests added (send, list, delete, auth, validation)
- [x] **Frontend components** — 64 component tests added across 6 files
- [x] **Rate limiting** — 7 Feature tests added (login, chat, playback, proxy, presence)
- [x] **Zustand stores** — 23 tests added: theme (5), room-ui (11), subtitle (7)
- [x] **Dashboard a11y test** — un-skipped (uses `__test/setup-verified-room` helper)
- [x] **Auth/profile a11y (Batch 2D, TAM-004)** — axe coverage added for `/reset-password/{token}`, `/confirm-password`, and the Profile delete-account modal in its open state; login, register, forgot-password, verify-email, and Profile default state were already covered by `tests/a11y/a11y.spec.ts` + `tests/a11y/auth-a11y.spec.ts`
- [x] **E2E tests** — 12 of 12 pass (chat 2/2, lock-kick-transfer 4/4, room 3/3, subtitle 3/3)
- [x] **Subtitle content sanitization (Batch 2B, TAM-003)** — regression coverage added: backend `extractCues` strips script/`onerror` payloads (unit), end-to-end upload→`/cues` sanitization + `text/vtt` content-type (feature), frontend `parseVtt`/`parseSrt` strip script/img/javascript: payloads (parser), and overlay renders script-like cues as escaped text with no executable DOM element (overlay render). Security boundary confirmed safe — no behavior change

### Production & Security Guidance Correction (Batch G1, 2026-08-01) — documentation only
- [x] **Scheduler docs aligned with `routes/console.php`** — `docs/SYSTEM.md` 18.07 code block, 18.11 checklist, and the deployment-checklist skill now show exactly the 3 real scheduled tasks (rooms:prune-inactive --days=7 daily, queue:work --stop-when-empty --max-time=30 every minute, presence:timeout every minute); obsolete `sitemap:generate` / `sessions:prune` / `queue:work --max-time=50` removed.
- [x] **Rollback guidance corrected** — deployment-checklist skill now says restore the pre-deploy database backup or apply a specifically reviewed corrective migration; never `migrate:rollback` against production.
- [x] **`docs/ai/` reconciled with reality** — PROJECT_BASELINE: 13 migrations (not 14), queue worker confirmed as scheduler batch drain (no python wrapper / persistent worker), a11y 11/11 confirmed, coverage-gap section updated; ISSUE_REGISTER: TAM-002/003/004/005 marked RESOLVED (Batches 2A/2B/2D/2C), TAM-200 (a11y count) verified/resolved, Recommended Fix Order trimmed.
- [x] **Rate-limiting claim corrected (document only; no code change)** — SYSTEM.md 18.08 Rule 5 + 18.11 checklist, security-rules skill, ARCHITECTURE.md, and ENGINEERING_GUARDRAILS.md now state the true current state: login/chat/playback/proxy/presence/join/email-verification throttled; `POST /register`, `POST /forgot-password`, `POST /reset-password` NOT yet throttled (known gap to close before launch).
- [x] **Obsolete sitemap assumptions removed** — SYSTEM.md 18.06 Rule 2, 23.04 requirement 3, 23.06 checklist, and laravel-backend-rules skill no longer claim a generated sitemap (no `sitemap:generate` command exists; robots.txt is static).
- [x] **TASK.md stale checkboxes fixed** — Batch 2B subtitle sanitization and E2E 12/12 marked done.

### Frontend/Backend Architecture Guidance Correction (Batch G2, 2026-08-01) — documentation only
- [x] **Absolute "no client fetching" rule corrected across 8 files** — the blanket "pages never fetch their own data on mount" claim now has the approved polling carve-out (playback state, presence, chat via axios `api` client against session-auth JSON endpoints in `routes/web.php`), applied to AGENTS.md, FRONTEND_CONTRACT.md intro, SYSTEM.md 18.02 Rule 1, 18.11 checklist, 27.10 (both checklists), laravel-backend-rules skill, anti-patterns skill, ARCHITECTURE.md.
- [x] **"Every mutation via Form Request / useForm" absolutes corrected** — structured input → Form Request; simple single-field action endpoints → inline `$request->validate()` (e.g. `ChatController::store`); Inertia forms → `useForm`; JSON action endpoints → axios `api` with local pending state (room-settings `api.patch`, chat send). Updated in SYSTEM.md 16.05, 18.04 Rule 1/2, 18.08 Rule 1/3, 18.11, 24.05, 27.10, laravel-backend-rules, security-rules, ARCHITECTURE.md §2/§6.
- [x] **4-way endpoint taxonomy documented** — Inertia page props / JSON polling endpoints / JSON action endpoints (all `routes/web.php`, session guard) / external Sanctum `routes/api.php` (currently only `GET /user`). See laravel-backend-rules Structure section, security-rules rule 1, ARCHITECTURE.md §6.
- [x] **`usePollingReload` doc corrected to actual source** — SYSTEM.md 18.05 Rule 2 example now matches `usePollingReload(intervalMs = 5000)` + `router.reload()` (no `{ only }`), and notes production polling uses the axios `api` client, not this unused utility; ARCHITECTURE.md §4 updated.
- [x] **Fictitious examples replaced** — SYSTEM.md 18.02/18.04 replaced `Projects/Index`/`ProjectController`/`StoreProjectRequest` examples with the actual `RoomController::index`/`StoreRoomRequest`; 24.05 removed nonexistent `FormField.tsx` in favor of the real `InputError` component.
- [x] **FRONTEND_CONTRACT.md `chatMessages` → `chat_messages`** — Eloquent serializes the `chatMessages` relation as snake_case (`chat_messages`), matching `Show.tsx`'s `room.chat_messages`; §1.1 and §3.1 corrected.

### Repository Structure & Naming Alignment (Batch G3, 2026-08-01) — documentation only
- [x] **PROJECT.md directory tree aligned with the actual repo** — `PresenceTimeout.php` → `MarkStaleMembersOffline.php` (`# signature: presence:timeout`, matches `routes/console.php`); removed nonexistent `RoomMemberPolicy` / `SubtitleTrackPolicy` (only `ChatMessagePolicy` + `RoomPolicy` exist); added missing real files: `AdminController`, `JoinRoomRequest`/`ProfileUpdateRequest`/`UpdateRoomRequest`/`UploadSubtitleRequest`, `MemberPresenceChanged`/`NewChatMessage` events, `use-room-ownership`, `AuthenticatedLayout`/`GuestLayout`, `lib/api.ts`, `vite-env.d.ts`, and the real route files (`auth.php`, `channels.php`, `test-helpers.php`).
- [x] **Subtitle parser location corrected** — PROJECT.md listed a nonexistent `lib/subtitle-parser.ts`; SRT/VTT parsing actually lives in `Components/composite/subtitle-overlay.tsx` (`parseVtt`/`parseSrt`/`parseSubtitle`), and `lib/types/` holds plain TS types (not Zod schemas).
- [x] **Hooks/Layouts case corrected** — SYSTEM.md 18.05 rule comments and 28.05 import-order example, laravel-backend-rules skill, and output-conventions skill now use `resources/js/Hooks/` and `@/Components`, `@/Hooks`, `@/lib`, `@/stores` (uppercase dirs, real imports).
- [x] **React Query examples removed** — output-conventions skill no longer shows `@tanstack/react-query` (not installed); example imports replaced with real deps (`zustand`) and real hooks (`usePresence`, `useToast`).
- [x] **SYSTEM.md 15.03 File Organization tree + File Location Rule aligned** — dropped the generic `Components/layout/`, `Components/providers/`, `features/[feature]/components/` (none exist); layouts are in `resources/js/Layouts/`, composites are the real `room-chat`/`member-list`/`video-player`/`subtitle-overlay`/etc.; `Components/shared/` ref in 16.02 replaced with the real `Components/composite/`.

### Deployment & Environment Consistency (Batch G4, 2026-08-02) — documentation only
- [x] **Unconfirmed production domain replaced with placeholder** — `docs/PROJECT.md` `APP_URL=https://tamasharoom.app` and `docs/SYSTEM.md` API-client example `https://tamasharoom.app/api/v1` changed to `https://yourdomain.com` (the same placeholder `docs/deployment-checklist.md` already uses). The repository has not finalized a production domain: README claims `tamasharoom.ir`, `.env.example` ships `APP_URL=http://localhost`, PROJECT/SYSTEM previously claimed `tamasharoom.app`. Real domain to be set when registered.
- [x] **Node/cPanel build claim reconciled** — `docs/SYSTEM.md` 18.00 claimed "Node.js 22 is available on the host"; corrected to match `docs/deployment-checklist.md`: Node is a build-time tool only, the build may be run off-server (any machine with Node 22+), and cPanel needs only `public/build/`. The deployment-checklist skill's step 3 now states the off-server option explicitly.
- [x] **CI checks documented accurately** — `docs/SYSTEM.md` 29.02 "CI passes" now lists the full actual suite (build, lint, Pint, type-check, PHPUnit, Vitest, Playwright a11y + E2E), and the deployment-checklist skill's pre-deploy CI line includes Pint + Playwright (both run in `.github/workflows/ci.yml`).
- [x] **Prettier not gated in CI documented** — `npm run format:check` exists in `package.json` but CI has no Prettier step; noted in `docs/SYSTEM.md` 29.02 and the deployment-checklist skill so nobody assumes CI enforces formatting.
- [x] **ESLint warning threshold documented** — `package.json` lint script runs `eslint resources/js --max-warnings 4`; `docs/SYSTEM.md` 29.02 now states "zero errors and at most 4 warnings".
- [x] **PROJECT.md env block completed** — added `TAMASHAROOM_MAX_CONCURRENT_ROOMS=50` (from `config/tamasharoom.php`) and `SENTRY_DSN=` (from `config/sentry.php`); both already present in `.env.example`.
- [x] **Unresolved (documented only, NOT changed)** — `composer.json` is still template identity (`name: laravel/laravel`, `description: "The skeleton application for the Laravel framework."`, `license: MIT`) which conflicts with README's proprietary-notice; per Batch G4 rules legal/license metadata was not touched. Actual production domain still unfinalized. `public/build` is gitignored, so the off-server build must be uploaded manually.

### Final Documentation Consistency Cleanup (Batch G8, 2026-08-02) — documentation only
- [x] **Independent source-level test recount (methodology)** — PHPUnit: counted `#[Test]` attributes + `public function test_*` methods in every `tests/Feature/**/*.php` and `tests/Unit/**/*.php` (recursive); **194** static declarations (160 Feature + 34 Unit, incl. the 18-test `tests/Feature/Auth/` suite) = the 194 `php artisan test` runtime count (no data providers). Vitest: counted `it(`/`test(` declarations in all `resources/js/__tests__/*.test.ts(x)`; **122** static (99 non-store + 23 Zustand store: theme 5, room-ui 11, subtitle 7) = the 122 `npm run test` runtime count (no `it.each`/`test.each`). Playwright E2E **12** passed; axe **11** passed. No runtime-vs-static divergence anywhere — all previous figures that claimed different counts (183/151+32, 107/84+23, 136) were stale and corrected.
- [x] **`docs/TASK.md` Testing section synchronized** — the canonical counts now read 194 (160 Feature + 34 Unit), 122 Vitest (99 + 23 store), 12 E2E, 11 a11y, each with the recount date and static-vs-runtime note. Historical counts remain in their original dated entries and were not rewritten.
- [x] **`docs/PROJECT.md`** — Zustand row corrected from "theme, sidebar, modals" to the real stores (`theme`, `room-ui`, `subtitle`) with responsibilities; Architecture Principles now state the approved live-room Axios polling/action exception, clarify Form Requests (structured input) vs inline `$request->validate()` (simple action endpoints), and reframe "one controller / one Form Request / one Inertia page per resource" as a preferred organization pattern rather than a hard rule; Inertia versions documented accurately (`@inertiajs/react` 2.x client, `inertiajs/inertia-laravel` 3.1.x server); the authoritative design-system document is now identified as `design-systems/tamasharoom/DESIGN.md` (draft) — no stale `DESIGN.md` path reference existed in PROJECT.md itself; document metadata date updated to 2026-08-02.
- [x] **`FRONTEND_CONTRACT.md`** — subtitle behavior corrected: supported filename extensions are only `.srt` and `.vtt`; `txt` is solely a MIME-detection fallback (Symfony guesses SRT content as `txt`); a `.txt` filename itself is rejected by the post-validation extension check. POST auth-route naming claims corrected (unnamed POST routes do not inherit names from GET routes; the frontend posts to the URL generated by the named GET route, e.g. `route('login')`). Inertia client/server adapter versions clarified. Axios/live-room polling contract preserved unchanged.
- [x] **`docs/ai/PROJECT_BASELINE.md`** — test numbers recounted with the same source-level methodology (Backend 194 = 160 Feature + 34 Unit; Frontend 122 = 99 + 23 store; E2E 12; a11y 11); obsolete sidebar-store implication removed; room-ownership-transfer UX marked RESOLVED with historical context preserved.
- [x] **`docs/ai/ISSUE_REGISTER.md`** — TAM-003 wording reconciled: no claim that tests were executed beyond what was independently run this pass; historical verification distinguished from current independent verification.
- [x] **`.opencode/skills/testing-strategy/SKILL.md`** — baseline reconciled to the same verified counts (194 PHPUnit = 160 Feature + 34 Unit; 122 Vitest; 12 E2E; 11 a11y) with the static-vs-runtime (data-provider/parameterized) caveat preserved.
- [x] **`docs/SYSTEM.md`** — generic `fetch` guidance clarified to not override the shared Axios `api` client for live-room JSON polling/actions; overbroad API/Form Request/Policy wording narrowed to endpoints that accept input or access protected resources; Sanctum auth requirements kept accurate; no new architecture rule introduced.
- [x] **`PRODUCT.md`** — nonexistent `DESIGN.md` reference fixed: the file does not exist at that path; the authoritative design-system document is `design-systems/tamasharoom/DESIGN.md` (draft status).

### Authentication Rate-Limit Hardening (2026-08-02)
- [x] **Auth POST endpoints protected** — previously unthrottled `POST /register`, `POST /forgot-password`, and `POST /reset-password` now carry named Laravel rate limiters attached directly in `routes/auth.php` (same convention as the existing `throttle:login`).
- [x] **Limiter strategy** — three new named limiters in `app/Providers/AppServiceProvider.php`, all 5/min to match the existing login limiter: `register` (per-IP only), `forgot-password` (per-email+IP, mirrors `login`), `reset-password` (per-IP only). No new library, no DB/schema/dependency/deploy/frontend changes; existing `login`/`chat`/`playback`/`proxy`/`presence`/`join` limiters untouched.
- [x] **Tests** — 8 tests added to `tests/Feature/RateLimiterTest.php` (15 total in the class): each endpoint allows requests under the limit and returns 429 past it, scoping is proven per-IP (`register`, `reset-password`) and per-email (`forgot-password`), legitimate registration is allowed, and a route-attachment test asserts `throttle:*` middleware is actually bound to the intended POST routes (including `throttle:login` unchanged).
- [x] **Test results** — `php artisan test`: **202/202 passed** (194 baseline + 8 new); Auth filter: **23/23 passed**; RateLimiterTest: **15/15 passed**. `npm run type-check` and `npm run lint` clean (no frontend impact); `./vendor/bin/pint` clean on the 3 changed files.

### AI/Context Efficiency (Phase 1 & 2, 2026-08-02)
- [x] **Test-count reconciliation** — verified actual `php artisan test` = **214** (703 assertions) and static source count = 214 (173 Feature + 41 Unit). The skills' 214 was correct; `docs/TASK.md`'s "202" was stale. Corrected the Testing section to **214** and established `docs/TASK.md` as the **single canonical source** for test counts; skills reference it instead of hardcoding.
- [x] **`docs/SYSTEM.md` chapter→line index** — added a compact 29-chapter index at the top (verified all 29 ranges match actual `# NN` header positions). Skills referencing "SYSTEM.md Chapter NN" are now line-addressable via Read offset/limit.
- [x] **`docs/MAP.md` created** — lightweight navigation map: hierarchy, cross-cutting ref docs, and per-subsystem → skill/docs → controller/service → hook/component → test mappings (rooms, playback, chat, subtitles, presence, lifecycle, auth, security) + a test-location index. Points to files; never restates rules.
- [x] **`AGENTS.md` trimmed** — intro now points to `docs/MAP.md` and `docs/SYSTEM.md`'s chapter index; "Current Status" no longer hardcodes E2E/a11y counts (now says the canonical source is TASK.md). No non-negotiable rule removed.
- [x] **Skills de-staled** — removed hardcoded test counts from `testing-strategy` (now points to TASK.md) and `ai-efficiency` (removed the hardcoded PHPUnit/Vitest/E2E/a11y baseline, replaced with "see TASK.md"). Added a cross-reference from `laravel-backend-rules` endpoint categories to `security-rules`'s API-boundary section.
- [x] **`ai-efficiency` refined** — narrowed frontmatter description (no longer auto-activates for every task), added `docs/MAP.md` + SYSTEM.md chapter-index to progressive disclosure and exploration patterns, removed stale test-count example, encouraged `docs/MAP.md` + targeted source reads + compact task prompts.
- [x] **Skill-overlap review** — `react-rules`/`code-review-rules`, `laravel-backend-rules`/`security-rules`, `rtl-and-design-system`/`typescript-tailwind-rules`, `ai-efficiency`/`testing-strategy` were reviewed. Determined they are complementary lenses (architecture vs review vs watch), already cross-reference each other where overlap is real; no unique knowledge removed (per "don't remove useful knowledge just for line count").
- [x] **`docs/ai/` reviewed (NO/ACTION)** — `PROJECT_BASELINE.md` (343 lines) and `ARCHITECTURE.md` (474 lines) are level-4 **verification evidence** with confidence markers and inter-service flow analysis, not redundant restatement; they're not loaded in normal code flow. Converting to pointers would lose verified analysis, so left unchanged.
- [x] **Verification** — all 17 skill directories referenced in AGENTS.md table; no stale test counts remain anywhere in skills/AGENTS; SYSTEM.md index verified correct; `git diff` contains **docs/skills/context only** (no app code, tests, routes, migrations, or config).

#### Deployment Readiness
- [ ] **Migrations on production** — not executed (all 13 migrations have run only on local SQLite)
- [ ] **`storage:link`** — symlink does not exist (`public/storage` missing); subtitle uploads depend on it
- [ ] **Queue worker in production** — none needed: queue is drained in batches by the `schedule:run` cron (`queue:work --stop-when-empty`); no persistent worker to start
- [ ] **cPanel cron for `schedule:run`** — not added
- [ ] **`SESSION_SECURE_COOKIE=true`** — in `.env.example` since 2026-07-22; must be confirmed `true` in production `.env`
- [ ] **`APP_DEBUG=false`** — must be confirmed on production; currently `true` in local `.env`
- [ ] **`APP_ENV=production`** — must be set on production; currently `local`

## Pending

### Deployment
- [ ] Run migrations on production database
- [ ] Create `public/storage` symlink (`php artisan storage:link`); verify subtitle files reachable through it
- [ ] Configure queue drain for production (confirm `QUEUE_CONNECTION=database`; queue is processed in batches by the `schedule:run` cron — no worker/supervisor needed)
- [ ] Set up cPanel cron entry for `* * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1`
- [ ] Confirm `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true` in production `.env`

### Launch Blockers (single-core budget — SYSTEM.md 21.10)
- [x] **Enforce per-room member cap at join time**, including a `lockForUpdate()` guard against a join race on the last slot — `JoinRoomRequest` validates invite code; `RoomController@join` uses `DB::transaction` + `lockForUpdate()`; policy checks `isFull()` inside the locked transaction
- [x] **Enforce a system-wide active-room cap** — `config/tamasharoom.php` (`max_concurrent_rooms`, default 50); `StoreRoomRequest::after()` checks active room count on creation; user-facing validation error on reject
- [x] **Extend `rooms:prune-inactive`** to delete subtitle files from disk, subtitle tracks, chat messages, and members alongside the room row — uses `DeleteRoomAction` with `chunkById` for memory-safe pruning
- [x] **Ensure the owner-initiated "Delete room" path** uses the same cleanup logic — `RoomController@destroy` now uses `DeleteRoomAction`
- [x] **Implement `DetermineVideoPlaybackModeAction`** — SSRF-safe HEAD check; returns `'direct'` when source has CORS `*` + `Accept-Ranges: bytes`; falls back to `'proxy'`; stored on room row; frontend `VideoPlayer` reads `playback_mode` to choose direct or proxy source
- [x] **Add production error monitoring (Sentry)** — `sentry/sentry-laravel` v4.27 installed; `config/sentry.php` published; `.env.example` has `SENTRY_DSN` placeholder; disabled when DSN is empty

### Future Features
- [ ] Room ownership transfer UX polish (update member list after transfer) — **fixed 2026-08-01 (Batch 2C, TAM-005)**: ownership state now derives from the reactive `room-ui` store via new `useRoomOwnership` hook; old owner loses owner-only controls immediately, new owner adopts ownership from presence data, failed transfers leave state untouched. See Completed section.
- [ ] WebSocket migration for real-time events
- [ ] Chat/room moderation — report message, owner can delete any message (not just their own)
- [ ] Cover profile, password-reset, verify-email pages with a11y audits — **done 2026-08-01 (Batch 2D, TAM-004)**: axe tests now cover `/reset-password/{token}`, `/confirm-password`, and the Profile delete-account modal open state; see Completed section
- [ ] E2E tests for chat, subtitle, lock/kick, and transfer flows (now covered — 12 tests)

### Accepted MVP Limitations (tech debt)
- [ ] **SSRF TOCTOU gap (partially closed 2026-08-01)** — `UrlSecurityService::validateVideoUrl()` runs DNS resolution and IP checks once at the top of `VideoProxyService::stream()`. Within a single request, a DNS rebinding attack could pass validation for a safe IP and then resolve to a different (internal) IP by the time the HEAD request runs. The window is microseconds and the proxy requires authentication, so the risk is accepted for MVP. Batch 1 closed the *redirect* half of this: redirects are no longer auto-followed — each hop is re-validated by `UrlSecurityService` (TAM-007) — and TLS verification is now enabled on all stream contexts (TAM-009). Post-MVP fix: resolve the hostname synchronously, compare the resolved IP against the blocklist inside every stream context (as a `stream_context_set_param` wrapper), and fail on mismatch.
