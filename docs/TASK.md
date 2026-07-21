# TamashaRoom — Project Tasks

## Completed

### Core Infrastructure
- [x] Laravel 12 application with Inertia + React
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
- [x] Delete own messages
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
- [x] 36 Feature tests across all modules
- [x] 10 Unit tests
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

## Pending

### Deployment
- [ ] Run migrations on production
- [ ] Ensure storage link exists for subtitle files
- [ ] Configure queue worker for production
- [ ] Set up scheduler (cron)
- [x] **Add `.github/workflows/ci.yml** — PHP 8.4 + Node 22 matrix, Pint, ESLint, TypeScript check, Vite build, Pest tests (SQLite :memory:); MySQL-specific behavior not covered

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
- [ ] E2E accessibility tests with Playwright + axe
- [ ] Chat/room moderation — report message, owner can delete any message (not just their own)
