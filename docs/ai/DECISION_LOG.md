# DECISION_LOG.md

> Lightweight Architecture Decision Log for TamashaRoom. Records important
> decisions that are actually supported by project materials. Decisions without a
> documented historical date or rationale are marked as such — nothing is
> invented here.

---

## DECISION-001 — Laravel + Inertia + React architecture

- **ID:** DECISION-001
- **Title:** Replace Next.js App Router with Laravel 13 + Inertia.js 2 + React 19
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** The deployment target is shared cPanel hosting (Apache, PHP 8.4,
  MySQL, 2GB RAM, 1 CPU core, 20GB storage) with no Node.js runtime, no Docker,
  no Redis, no WebSockets, no persistent background workers, and no root access.
  The previous stack assumed the Next.js App Router / serverless model, which this
  hosting cannot support.
- **Decision:** PHP 8.4 + Laravel + Inertia.js + React 19 + Vite, with Node.js 22
  used only as a build-time tool. Controllers own data; React pages render
  Inertia props.
- **Reason:** Laravel is the most maintainable, best-documented option for this
  exact hosting profile — Composer-based deployment, migrations against MySQL,
  mature ecosystem, and a PHP-FPM request model that fits a single CPU core far
  better than a persistent Node.js server competing for 2GB RAM. Inertia provides
  the App Router's server-owned-data ergonomics without a Node runtime.
- **Consequences:** No separate REST layer for the app's own UI; every navigation
  is a real HTTP request; the frontend is still React + Tailwind + TypeScript;
  the migration to the new stack touched SYSTEM.md chapters 16–29 and PROJECT.md.
- **Alternatives considered:** Next.js App Router (rejected — hosting cannot run
  it); a pure Blade/PHP frontend (not considered per available materials).
- **Source:** docs/PROJECT.md "Current Status" (2026-07-20 entry), docs/SYSTEM.md
  ch. 18.00.

---

## DECISION-002 — Polling instead of persistent WebSockets

- **ID:** DECISION-002
- **Title:** Playback sync delivered by client polling, not WebSockets
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog; historical reasoning
  before this date not documented)
- **Status:** ACCEPTED (implemented)
- **Context:** Playback sync is the product's core mechanic and normally requires
  WebSockets. The MVP's shared cPanel hosting cannot run a WebSocket server, and
  cPanel cannot keep a long-lived process alive outside PHP-FPM's request
  lifecycle.
- **Decision:** Playback state changes are written as a Laravel broadcastable
  Event (`PlaybackStateChanged`); the frontend polls for state every 3 seconds
  (adjustable post-MVP) instead of receiving pushes.
- **Reason:** Polling is the only transport available within the hosting budget.
  State changes are still written through the Event so the transport remains
  swappable (see DECISION-003).
- **Consequences:** Roughly 1–2 seconds of sync drift between members — acceptable
  for the test/MVP phase, not frame-accurate. Polling intervals are kept in
  seconds and only while relevant UI is visible, to protect the single CPU core.
- **Alternatives considered:** WebSockets (rejected — hosting constraint);
  direct model polling (rejected — see DECISION-003).
- **Source:** docs/PROJECT.md "Real-Time Architecture", docs/SYSTEM.md ch. 18.05.

---

## DECISION-003 — Room-state reads always go through the Event (transport-agnostic)

- **ID:** DECISION-003
- **Title:** Never build room-state features against direct polling of a model
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** To keep the future WebSocket migration a driver swap rather than a
  feature rewrite, the read path and write path must both be transport-agnostic.
- **Decision:** Every room-state change is written as a broadcastable Event; the
  frontend polls for it today and will receive pushes later via Laravel Echo. No
  component reads room state by directly polling a model.
- **Reason:** A `BROADCAST_CONNECTION` config change plus Reverb install must be
  sufficient to move to real-time — no feature rewrite.
- **Consequences:** The `usePlaybackSync` hook hides the transport; the migration
  is a hook rewrite plus config change. Frontend components do not change.
- **Alternatives considered:** Direct model polling (rejected — would require a
  rewrite to go real-time later).
- **Source:** docs/PROJECT.md "Real-Time Architecture", AGENTS.md, docs/SYSTEM.md
  ch. 18.05 Rule 3.

---

## DECISION-004 — External video hosting, not storing files

- **ID:** DECISION-004
- **Title:** Support external video links only; store no video files
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog — the product definition)
- **Status:** ACCEPTED (implemented)
- **Context:** TamashaRoom is a watch-party platform for Persian users. Storing or
  hosting video files would require substantial storage (20GB budget) and legal/
  content handling.
- **Decision:** Rooms use an external video URL as the source. No video files are
  stored on the server; only playback state, chat, subtitles, and membership are.
- **Reason:** Fits the 20GB storage budget; keeps the platform a synchronization
  layer rather than a content host.
- **Consequences:** Playback depends on external sources being reachable; hence
  the direct-vs-proxy playback mode decision (DECISION-005) and the SSRF
  validation boundary.
- **Alternatives considered:** File uploads/hosting (rejected — storage and
  content implications not supported by MVP materials).
- **Source:** docs/PROJECT.md "Core Concept", docs/TASK.md.

---

## DECISION-005 — Direct-vs-proxy video playback mode

- **ID:** DECISION-005
- **Title:** Auto-detect playback mode: direct client playback or server proxy
- **Date:** 2026-07-21 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** External video sources vary in CORS and range-request support.
  Proxying every video through a 1-CPU-core server is expensive; direct playback
  is not always possible.
- **Decision:** `DetermineVideoPlaybackModeAction` performs an SSRF-safe HEAD
  check. If the source supports CORS `*` + `Accept-Ranges: bytes`, playback mode
  is `direct` (the `<video>` loads it directly). Otherwise it is `proxy` (server
  streams it). The mode is stored on the room row as a `PlaybackMode` backed enum.
- **Reason:** Balance single-core CPU budget against source compatibility;
  delegate bandwidth to the client whenever possible.
- **Consequences:** `VideoProxyService` handles range requests, MIME mapping, and
  rate limiting; SSRF validation protects the proxy path.
- **Alternatives considered:** Always-proxy (rejected — CPU/bandwidth cost);
  always-direct (rejected — incompatible sources would break).
- **Source:** docs/TASK.md "Launch Blockers", FRONTEND_CONTRACT.md §7.1.

---

## DECISION-006 — Shared-hosting compatibility as a hard constraint

- **ID:** DECISION-006
- **Title:** Design within the shared-hosting budget (no Docker/Redis/WebSockets/workers)
- **Date:** 2026-07-20 (re-architecture date); principle stated in AGENTS.md
- **Status:** ACCEPTED (enforced)
- **Context:** The deployment target is shared cPanel hosting with 2GB RAM, 1 CPU
  core, 20GB storage and no root access.
- **Decision:** No feature may assume Docker, Redis, WebSockets, a persistent
  background worker, or horizontal scaling as a fallback. Cache, session, and
  queue use database drivers; background work runs on a scheduled basis via the
  single cron entry.
- **Reason:** The hosting cannot provide these; assuming them guarantees a broken
  production deploy.
- **Consequences:** Polling-based sync, database cache/session/queue, one cron
  entry running `schedule:run`, no sub-minute background processing assumptions.
- **Alternatives considered:** VPS hosting (deferred — MVP phase targets shared
  hosting; migration path is planned).
- **Source:** AGENTS.md, docs/PROJECT.md, docs/SYSTEM.md ch. 18.

---

## DECISION-007 — Private room model with invite links

- **ID:** DECISION-007
- **Title:** Rooms are private, joined via 12-char invite codes
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog — product definition)
- **Status:** ACCEPTED (implemented)
- **Context:** The product is for friends/family watching together; rooms are not
  meant to be publicly discoverable.
- **Decision:** A user creates a room and receives a 12-char random invite code;
  anyone with the link joins. Room lock prevents new joins; owner can regenerate
  the invite code.
- **Reason:** Matches the private, social use case; no public discovery needed for
  MVP.
- **Consequences:** Join route rate-limited (10/min); room membership is
  authorization-gated; owner controls who is in the room (kick, lock).
- **Alternatives considered:** Public rooms with discovery (deferred — not in MVP).
- **Source:** docs/PROJECT.md "Core Concept", FRONTEND_CONTRACT.md.

---

## DECISION-008 — Sanctum for external API consumers

- **ID:** DECISION-008
- **Title:** Sanctum token auth for routes/api.php
- **Date:** 2026-07-22 (from docs/TASK.md)
- **Status:** ACCEPTED (implemented)
- **Context:** External/mobile consumers need a token-based API separate from the
  session-based app UI.
- **Decision:** Install Laravel Sanctum, publish its config, run its migration;
  route Inertia pages through the session guard and API routes through Sanctum
  tokens.
- **Reason:** Laravel's standard, supported token auth for the API surface.
- **Consequences:** `personal_access_tokens` migration added; API rules in
  docs/SYSTEM.md ch. 18.08 apply (Form Requests, rate limits, typed resources).
- **Alternatives considered:** JWT packages / Passport (not supported by available
  materials).
- **Source:** docs/TASK.md (2026-07-22 entry), config/migrations listing.

---

## DECISION-009 — Sentry for error monitoring

- **ID:** DECISION-009
- **Title:** Sentry error monitoring, disabled when no DSN
- **Date:** 2026-07-21 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** Production errors must be observable on shared hosting without
  infrastructure complexity.
- **Decision:** Install `sentry/sentry-laravel`, publish `config/sentry.php`, add
  a `SENTRY_DSN` placeholder to `.env.example`; disabled when DSN is empty.
- **Reason:** Hosted error monitoring that requires no extra server infrastructure.
- **Consequences:** Error reporting available in production; nothing sent when the
  DSN is unset.
- **Alternatives considered:** Self-hosted monitoring (rejected — hosting
  constraint).
- **Source:** docs/PROJECT.md "Current Status", docs/TASK.md.

---

## DECISION-010 — Room ownership determined by comparison, no role column

- **ID:** DECISION-010
- **Title:** Ownership = user_id equals room.user_id; no `role` field
- **Date:** 2026-07-20 (implementation period; exact date not separately recorded)
- **Status:** ACCEPTED (implemented)
- **Context:** Distinguish owner from members without adding a role enum.
- **Decision:** There is no `role` column. Ownership is computed by comparing
  `RoomMember.user_id` to `Room.user_id`; exposed to the frontend as an
  `is_owner` boolean.
- **Reason:** Single source of truth for ownership; no denormalized role to keep
  in sync (especially important across ownership transfer).
- **Consequences:** `is_owner` appended on `RoomMember` serialization; any place
  needing ownership must compare against `room.user_id`.
- **Alternatives considered:** A role/permissions column (not supported by
  materials; rejected in favor of comparison).
- **Source:** FRONTEND_CONTRACT.md §3.3, app/Models/RoomMember.php.

---

## Decision Log Maintenance

New decisions get a new ID in sequence. Only decisions actually supported by
project materials (source code, docs, or verified test results) should be added.
If historical reasoning is unknown, say so explicitly rather than inventing it —
as done above for DECISION-002.


## DECISION-011 - Guest join = real user row with is_guest flag

- **ID:** DECISION-011
- **Title:** Unauthenticated watch-room join via a flagged user row, not a guest/anon role
- **Date:** 2026-08-07
- **Status:** ACCEPTED (implemented)
- **Context:** Invite-link recipients without an account should join a room and
  watch/chat with only a display name - no email/password/login. But the schema
  forces a real `users` row for a member: `users.email` is NOT NULL unique,
  `users.password` is NOT NULL, and `room_members.user_id` / `chat_messages.user_id`
  are NOT NULL FKs with no nullable "guest user" channel.
- **Decision:** A joining guest becomes a real `users` row with `is_guest = true`,
  a randomized unique `guest-{uuid}@tamasharoom.local` email, and a random
  password. `RoomController@join` creates it and calls `Auth::login` only after
  `Gate::forUser($user)->authorize('join', $room)` passes, so full/locked rooms
  never leave an orphan guest row. The `/rooms/join/{inviteCode}` GET/POST routes
  moved out of the `['auth','verified']` group (still `throttle:join`).
- **Reason:** Reuses the entire existing stack - `RoomPolicy`, chat, playback,
  presence, and subtitle routes all already branch on the authenticated user, and
  `verified` middleware is a no-op because `User` does not implement
  `MustVerifyEmail`. No new "guest member" concept, no nullable-FK schema change,
  no parallel auth channel.
- **Consequences:** A guest occupies a `users` row (potential growth; accept for
  MVP, prunable later). Guests can join rooms *only* via the invite link; they
  never see a global dashboard because registration stays account-gated.
- **Alternatives considered:** Separate anonymous `room_guests` table
  (rejected - duplicates the whole member identity contract); making user FKs
  nullable (rejected - schema-wide churn, weakens referential integrity).
- **Source:** app/Http/Controllers/RoomController.php, app/Models/User.php,
  routes/web.php, tests/Feature/GuestJoinTest.php.

---

## DECISION-012 - Custom player controls on native `<video>`

- **ID:** DECISION-012
- **Title:** Rebuild the player UI on native `<video>`, not a player library
- **Date:** 2026-08-07
- **Status:** SUPERSEDED by DECISION-013 (Plyr) on 2026-08-07 — see below.
- **Context:** The player needed a polished, buffered-aware seekbar, keyboard
  shortcuts, RTL/mobile support, with soft subtitle overlay - while continuing to
  drive the existing play/pause/seek sync contract. Native browser controls cannot
  show buffered+position cleanly and controlled sync.
- **Decision:** Rebuild the control overlay by hand over the native `<video>`
  element (no library). The seekbar renders a buffered rail (`video.buffered`) +
  a played fill + thumb; time is a `tabular-nums` current/duration readout;
  keyboard shortcuts (Space, ArrowLeft/Right, m, f) are scoped to the player
  wrapper (`tabIndex=0`, `aria-keyshortcuts`) so the chat box and seek slider are
  never hijacked.
- **Reason:** A library (Plyr etc.) would add a dependency for UI that the native
  element + React state already cover, and any opinionated library fights the
  existing sync contract. Keeping it hand-written keeps the polling-to-WebSocket
  migration branch a pure transport swap with no player coupling.
- **Status change 2026-08-07:** REVERSED after implementation review — the
  hand-rolled keyboard/slider logic turned out harder than expected to keep
  accessible and RTL-correct (custom slider drag math, keyboard focus management,
  `aria-keyshortcuts` conflicts), and the implementer's manual `<video>` wiring
  was recreated by Plyr anyway (see DECISION-013).
- **Source:** resources/js/Components/composite/video-player.tsx (deleted),
  resources/js/__tests__/video-player.test.tsx (deleted).

---

## DECISION-013 - Plyr player (`plyr-react`) for the media surface

- **ID:** DECISION-013
- **Title:** Adopt Plyr (`plyr-react`) as the media player UI
- **Date:** 2026-08-07
- **Status:** SUPERSEDED by DECISION-014 (Video.js v10) on 2026-08-07 — see below.
- **Context:** The hand-written player (DECISION-012) carried its own seekbar
  math, keyboard scoping, buffered rails, and RTL/accessibility fixes that a
  battle-tested library already ships. Replacing it needed to keep the exact
  poll-to-Event sync contract (`use-playback-sync` → `sync`/`syncImmediate`)
  and the drift/tap-to-play/ended overlay behaviors working.
- **Decision:** Render `PlyrPlayer` (a thin presenter) + `SyncedPlyrPlayer` (the
  sync shell) in `resources/js/Components/Player/`. Plyr owns controls (Persian
  `i18n`, RTL video bar), keyboard, buffer, captions (native `<track>`), and
  fullscreen. The sync shell keeps host/guest authority rules, drift correction
  via `computeExpectedPosition`, autoplay-blocked overlay, proxy→direct
  fallback, end card, and the subtitle cue overlay.
- **Reason:** Eliminates ~500 lines of hand-rolled control/seek/keyboard RTL
  code, gives accessibility + captions for free, and the sync stays a transport
  swap (plays through the same hook). Verified fixes that made it work:
  (1) `Plyr` swallows `timeupdate` — listeners bind on the **media element**
  (`player.media`), not the instance; (2) `react-aptor` recreates the instance
  when `source` changes, so a watchdog re-binds to whatever media element is
  current; (3) `apiRef.current.plyr` becomes a placeholder Proxy before mount —
  every handler reads the live media element, never assumed instance fields;
  (4) `apply`-driven `play()`/`pause()` re-fires native `play`/`pause` events —
  an `applyingRef` guard prevents the resulting sync loop that previously
  yanked the host backward; (5) the host syncs play/pause with a position so
  the server never records a stale `position_seconds:0`.
- **Status change 2026-08-07:** SUPERSEDED. Plyr's `source` change path proved
  unreliable in the field: `react-aptor` destroys and recreates the whole
  instance (with its element listeners) on every src swap, forcing the ~200 ms
  watchdog re-bind, and Plyr's `timeupdate` suppression kept the event contract
  fragile. Video.js v10 (DECISION-014) replaces it.
- **Consequences:** `plyr-react` + `plyr` added to dependencies; the sync hook,
  controllers, and event model are untouched. Custom controls code (DECISION-012)
  and its tests removed. Replaced by DECISION-014.
- **Alternatives considered:** Keeping DECISION-012's custom controls (rejected —
  the seekbar/X.550RTL/accessibility cost outweighs it), video.js (rejected — an
  equal dependency with no user-facing gain over Plyr here).
- **Source:** resources/js/Components/Player/PlyrPlayer.tsx,
  resources/js/Components/Player/SyncedPlyrPlayer.tsx,
  resources/js/__tests__/plyr-player.test.tsx.

---

## DECISION-014 - Video.js v10 (`@videojs/react`) for the media surface

- **ID:** DECISION-014
- **Title:** Adopt Video.js v10 (`@videojs/react`) as the media player UI
- **Date:** 2026-08-07
- **Status:** ACCEPTED (implemented)
- **Context:** Plyr (DECISION-013) carried the playback surface but its
  integration was fragile in exactly the area this app depends on: source
  changes. `react-aptor` destroys and recreates the entire player instance on
  every `source` swap, dropping the media-element event listeners the sync
  contract binds — the workaround was a ~200 ms watchdog re-bind and a host of
  lifecycle guards. The replacement must keep the exact poll-to-Event sync
  contract (`use-playback-sync` → `sync`/`syncImmediate`) and all overlay
  behaviors (drift, tap-to-play, end card, proxy→direct fallback, subtitles).
- **Decision:** Rebuild the player on Video.js v10 (`@videojs/react`
  `10.0.0-beta.26`): `VideoJsPlayer` (thin presenter) + `SyncedVideoJsPlayer`
  (sync shell) in `resources/js/Components/Player/`, with `lib/player-source.ts`
  holding the position-preservation decision. v10's **`store.loadSource()`** is
  the documented src-change API — it mutates the SAME `<video>` element
  (`media.src = src; media.load()`), so element-bound event listeners survive
  every source swap and no watchdog/recreate logic is needed. Source changes are
  therefore driven through the store, never through React `key`/remount. Persian
  i18n via `I18nProvider locale="fa"` + `@videojs/react/i18n/locales/fa/register`
  (play="پخش", pause="توقف", seek="جستجو"); the v10 skin CSS is imported in
  `resources/css/app.css` (replacing the plyr stylesheet).
- **Reason:** Solves the exact failure mode that sank DECISION-013: a stable
  element identity across src swaps, so the sync shell binds native `play`,
  `pause`, `seeked`, `timeupdate`, `ended`, `error` once and they keep working.
  The `applyingRef` guard, host/guest authority, drift correction, and the
  autoplay-block/end overlays port over unchanged. v10 is transport-agnostic —
  the polling→WebSocket migration stays a driver swap.
- **Key implementation notes:**
  - `loadSource()` throws until the store is attached; the `Player.Provider`
    attaches in an effect after first commit, so the load effect gates on
    `store.target` with a `setTimeout(0)` retry.
  - `Player.usePlayer()` returns the store instance; `useMedia()` returns the
    raw media element (used as the `<Video>` ref), so `SubtitleOverlay` reads a
    live `HTMLVideoElement` through the imperative handle.
  - `loadSource` natively resets `currentTime`; `lib/player-source.ts` decides
    when a source change is a same-content proxy→direct transport fallback
    (preserve position, clamped to the new duration) vs. a genuinely new video
    (reset — `PlaybackController@setVideo` already zeroes `position_seconds`).
  - Imperative handle contract preserved: getCurrentTime, getDuration,
    getVolume, isPlaying, seekTo, play, pause, toggleMuted, toggleCaptions,
    enterFullscreen, getVideoElement.
- **Consequences:** `@videojs/react` + `@videojs/*` deps replace `plyr-react`
  (removed). The sync hook, controllers, events, and polling are untouched.
  Show-page bundle grows (~97 kB gzip) for the full-featured v10 skin; skin CSS
  replaces the plyr stylesheet. E2E selectors moved from `.plyr__controls
  button[data-plyr="play"]` / slider "موقعیت پخش" to `button.media-button--play`
  / slider "جستجو".
- **Alternatives considered:** Keeping Plyr and hardening the watchdog
  (rejected — fights the library's destroy/recreate model); native `<video>` +
  hand-rolled controls (rejected in DECISION-012/013 — accessibility/RTL cost);
  driving src changes via a React `key` remount on v10 (rejected — breaks the
  same-element guarantee that makes the listener binding work).
- **Source:** resources/js/Components/Player/VideoJsPlayer.tsx,
  resources/js/Components/Player/SyncedVideoJsPlayer.tsx,
  resources/js/lib/player-source.ts,
  resources/js/__tests__/videojs-player.test.tsx,
  resources/js/__tests__/player-source.test.ts,
  tests/e2e/playback-sync-verification.spec.ts, tests/e2e/tap-to-play.spec.ts.

## DECISION-015 — Pusher → Apinator migration path

- **ID:** DECISION-015
- **Title:** Apinator as backup broadcast driver (Pusher-compatible endpoint)
- **Date:** 2026-08-07
- **Status:** ACCEPTED (configured, inactive — `BROADCAST_CONNECTION` stays `pusher`)
- **Context:** Pusher Channels is the active real-time transport, but it is a
  single vendor dependency for the product's core playback-sync and presence
  mechanics. A second, Pusher-compatible hosted endpoint costs no client SDK
  change and de-risks a vendor outage. Self-hosting Reverb remains the eventual
  destination (per DECISION-002 / the transport-agnostic backbone), but that
  needs a VPS, which is out of the current shared-hosting budget.
- **Decision:** Add an `apinator` broadcast connection to
  `config/broadcasting.php` (`driver => 'pusher'`, custom `host =>
  api.apinator.io`) and a matching branch in `resources/js/lib/echo.ts` driven
  by `VITE_BROADCAST_CONNECTION`. Configured but inactive; the active driver
  stays `pusher`.
- **Reason:** Apinator's free tier covers up to 500 concurrent connections —
  headroom for the MVP — and it speaks the same Pusher protocol, so `pusher-js`
  + `laravel-echo` and the `PusherBroadcaster` backend need no rework. Switching
  is an env change (`BROADCAST_CONNECTION=apinator` +
  `VITE_BROADCAST_CONNECTION=apinator`), exactly the driver-swap the
  transport-agnostic design was built for.
- **Consequences:** The `apinator` connection is defined but dormant; no secrets
  live in `.env.example` (placeholders only). CI keeps `BROADCAST_CONNECTION=null`
  so broadcasts stay no-ops and the frontend polls. Future: migrate to a
  self-hosted Reverb when approaching 500+ concurrent connections or when more
  stability is needed.
- **Source:** config/broadcasting.php, resources/js/lib/echo.ts, .env.example,
  docs/TASK.md "Pusher Push Transport: broadcast delivery for E2E".

---

## DECISION-016 - Resend transport for email verification

- **ID:** DECISION-016
- **Title:** Resend as the transactional mail transport; verified accounts enforced via `MustVerifyEmail` with guest exemption
- **Date:** 2026-08-08
- **Status:** ACCEPTED (implemented; real `RESEND_KEY` not committed by design)
- **Context:** TamashaRoom needs to verify real registered users' email addresses. The deployment target is shared cPanel hosting with PHP 8.4 and no persistent workers, so any per-user transactional mail must go through a hosted API transport rather than a locally-run SMTP daemon. Guest accounts (`is_guest = true`) use synthetic email addresses (`guest-{uuid}@tamasharoom.local`) and must never be forced through the verification gate.
- **Decision:** Use Resend via Laravel's built-in `resend` mail transport (the `resend/resend-php` SDK installed via Composer), `MAIL_MAILER=resend` with `RESEND_KEY` from env. User model implements `Illuminate\Contracts\Auth\MustVerifyEmail`; `verified` middleware already guards the app's main route group (`routes/web.php`). `hasVerifiedEmail()` is overridden to short-circuit `true` for guest accounts so their synthetic emails never trip the gate. The verification email is a custom Persian `App\Notifications\VerifyEmail` extending the framework's signed-URL notification.
- **Reason:** Resend is a first-class Laravel mail transport (no third-party driver package or facade fork needed) and fits the shared-hosting budget better than running a mail stack locally. Guarding with the framework's own `verified` middleware + signed-URL mechanics keeps the flow standard; the guest exemption lives in one documented override rather than scatter checks across controllers.
- **Consequences:** Real unverified users are redirected to the verification prompt and cannot reach the gated app routes until they verify; guests bypass verification entirely. The `verified` middleware now has real effect on routes that previously were behind an inert middleware. `MAIL_MAILER` remains `array` in tests. Production requires the real `RESEND_KEY` in the environment; `.env.example` carries blank placeholders only.
- **Source:** app/Models/User.php, app/Notifications/VerifyEmail.php, config/services.php, .env.example, tests/Feature/Auth/EmailVerificationTest.php.

---

## DECISION-017 - shadcn-style UI primitives; Magic UI deferred for MVP

- **ID:** DECISION-017
- **Title:** Adopt shadcn/ui-style primitives (Radix + CVA) for new composable UI; skip Magic UI for MVP
- **Date:** 2026-08-08
- **Status:** ACCEPTED (implemented)
- **Context:** The emoji picker (Frimousse) needs an anchored popover, the async feedback surface needed a reliable global toast, and the `Input/Button/Card/Dialog` family was hand-rolled one file at a time. The pre-existing DESIGN.md mandated Headless UI only and "do not introduce Radix"; the task directive overrode that for the new primitive set.
- **Decision:** Add a `resources/js/Components/ui/` shadcn-convention layer built on `@radix-ui/*` (`dialog`, `popover`, `select`, `switch`, `tabs`, `tooltip`, `avatar`, `label`, `slot`, `separator`) + `class-variance-authority` + `tailwind-merge` (via the existing `cn()`). Replace the whole toast system with **Sonner** (`ui/sonner.tsx`, mounted globally in `app.tsx`), and build the emoji picker with **Frimousse** (`ui/emoji-picker.tsx`, headless — no UI opinion) in the room-chat composer. Existing shipped Headless UI / native `<dialog>` modals stay untouched. **Magic UI (magicui.design) is explicitly NOT adopted for MVP** — its components are decorated/motion-first, add bundle weight and animation cost, and fail the scope firewall for a watch-party MVP; recorded as a future candidate when the product needs a promotional landing treatment, not today.
- **Reason:** shadcn/ui conventions give typed, theme-token-driven primitives without owning a dependency framework, and Radix handles a11y (focus trapping, arrow-key nav, portals) that Headless UI does not expose for popovers/toasts as cleanly. Skip Magic UI: the same primitives as shadcn-style classes keep bundle and motion budgets intact.
- **Consequences:** Two headless libraries coexist (Headless UI for legacy modals, Radix for new primitives) — a deliberate, documented boundary, not drift. `toast.tsx`/`use-toast.ts` deleted; all 6 call sites import `toast` from `sonner`. Type-check, lint, Prettier, Vitest, chat E2E, and a11y all pass.
- **Source:** package.json, resources/js/Components/ui/{sonner.tsx, popover.tsx, emoji-picker.tsx}, resources/js/Components/composite/room-chat.tsx, resources/js/app.tsx.

## DECISION-018 — Dark indigo/rose palette + Vazirmatn/Inter fonts

- **ID:** DECISION-018
- **Title:** Replace the warm amber/charcoal palette with a dark indigo-first palette (#0A0A0F / #6366F1 / #F43F5E) and pair Vazirmatn with Inter for Latin glyphs
- **Date:** 2026-08-08
- **Status:** ACCEPTED (implemented)
- **Context:** DESIGN.md's warm amber palette (HSL(40,...) family) from 2026-08-05 was the previous authority; the task directed a new dark indigo/rose palette with near-black backgrounds and a Latin-font companion for Vazirmatn.
- **Decision:** Rework `@theme` + `:root` + `.dark` tokens in `resources/css/app.css`: near-black indigo background `#0A0A0F` (dark), indigo primary, rose destructive, cool indigo-tinted grays, and `--ring: hsl(239 84% 67%)` (`#6366F1`) with `#6366F1`/`#F43F5E` reserved for focus rings, info, and tinted decorations. Solid button fills use the AA-safe 600-level shades (`#4F46E5`, `#E11D48`), because #6366F1's luminance (≈0.185) lands at 4.47:1 vs white — just under the 4.5:1 small-text threshold. Fonts: keep Vazirmatn as the Persian primary (its `unicode-range` already excludes Latin) and add **Inter Variable** (`@fontsource-variable/inter`) as the Latin fallback in the stack. Updated the theme-color meta, error pages (404/500), logo SVG, and Inertia progress bar off the old amber.
- **Reason:** Indigo-on-near-black reads as the shared-evening cinematic mood without the amber palette's light/dark primary split; one AA-safe fill per mode instead of that split. Inter replaces the generic system-ui fallback for the Latin glyphs Vazirmatn intentionally does not cover.
- **Consequences:** A real contrast fix: the landing invite-code chip previously used `bg-primary-foreground/20` and now `bg-black/20` to hold ≥4.5:1 in both modes. DESIGN.md, PROJECT.md, and quality-report.md updated to the new palette. a11y suite: welcome + 9 others pass; the pre-existing `auth-a11y` "Verify email" registration test still fails (unrelated — a registration redirect timeout).
- **Source:** resources/css/app.css, resources/css/fonts.css, resources/views/app.blade.php, resources/views/errors/{404,500}.blade.php, resources/js/{app.tsx, Components/ApplicationLogo.tsx, Pages/Welcome.tsx}, design-systems/tamasharoom/DESIGN.md.
