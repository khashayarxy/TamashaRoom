# ARCHITECTURE.md

> Technical architecture reference for TamashaRoom as it **currently exists**.
> This document describes the implemented system; it does not propose a new one.
> Where a statement is only supported by documentation and not re-verified
> against the source in this pass, it is marked accordingly.
>
> **Source of truth:** This file is level 4 of the source-of-truth hierarchy
> (AI-maintained docs). If it conflicts with the source code (level 1), executable
> tests (level 2), or the canonical docs `docs/SYSTEM.md`, `docs/PROJECT.md`,
> `docs/TASK.md` (level 3), the higher level wins and this file needs a correction.
> See `README.md` → "Source-of-Truth Hierarchy".

---

## 1. High-Level Architecture

TamashaRoom is a server-driven SPA: Laravel (PHP 8.4) is the single source of
truth for data and routing, and React (via Inertia.js) renders the UI in the
browser. There is no separate REST layer for the app's own UI — every navigation
is a real HTTP request to a Laravel route, and Inertia returns either a full HTML
document (first load) or JSON page props (subsequent navigations).

```
┌──────────────────────────────┐
│        Browser (React 19)     │
│  Inertia SPA · RTL · Persian │
│  Zustand (UI state)          │
│  Polling hooks (3s/5s/30s)   │
└──────────────┬───────────────┘
               │ HTTP (Inertia visits + JSON endpoints)
┌──────────────▼───────────────┐
│        Laravel 13 (PHP 8.4)  │
│  Routes/web.php + api.php    │
│  Controllers → Props/JSON    │
│  Form Requests (validate+auth)│
│  Policies (authorize)        │
│  Actions / Services (logic)  │
└───────┬────────────────┬─────┘
        │                │
┌───────▼───────┐  ┌─────▼──────────────┐
│ MySQL/MariaDB │  │ External video     │
│ (rooms, chat, │  │ sources (proxied   │
│  subtitles…)  │  │ or direct)         │
└───────────────┘  └────────────────────┘
```

**Deployment reality (the one constraint that shapes everything):** shared cPanel
hosting — Apache, PHP-FPM, 1 CPU core, 2GB RAM, 20GB storage. No Docker, no Redis,
no WebSockets, no persistent workers, no root access. Node.js 22 is used only at
build time to compile the frontend. [Confirmed — docs/SYSTEM.md ch. 18.00,
docs/PROJECT.md]

---

## 2. Backend Structure

```
app/
├── Actions/                      # single-responsibility business logic
│   ├── DeleteRoomAction.php
│   └── DetermineVideoPlaybackModeAction.php
├── Console/Commands/             # scheduled tasks
│   ├── PruneInactiveRooms.php
│   └── MarkStaleMembersOffline.php   # signature: presence:timeout
├── Enums/
│   └── PlaybackMode.php          # Direct='direct' | Proxy='proxy'
├── Events/                       # broadcastable events (polled today, pushed later)
│   ├── PlaybackStateChanged.php  # PresenceChannel room.{id} — playback.state.changed
│   ├── NewChatMessage.php        # PresenceChannel room.{id} — chat.message.new
│   ├── MemberPresenceChanged.php # PresenceChannel room.{id} — member.presence.changed
│   └── SubtitleDefaultChanged.php # PresenceChannel room.{id} — subtitle.default.changed
├── Http/
│   ├── Controllers/
│   │   ├── Auth/                 # login, register, password reset, verification
│   │   ├── ChatController.php
│   │   ├── PlaybackController.php
│   │   ├── PresenceController.php
│   │   ├── ProfileController.php
│   │   ├── RoomController.php
│   │   ├── SubtitleController.php
│   │   └── VideoStreamController.php
│   ├── Middleware/               # HandleInertiaRequests, SecurityHeadersMiddleware
│   └── Requests/                 # Form Requests — validation + authorization
├── Models/                       # User, Room, RoomMember, ChatMessage, SubtitleTrack
├── Policies/                     # RoomPolicy, ChatMessagePolicy
├── Services/                     # PresenceService, SubtitleConverterService,
│                                 # UrlSecurityService, VideoProxyService
└── Providers/
    └── AppServiceProvider.php    # rate limiters, Vite prefetch
```

[Confirmed — directory listing + docs/PROJECT.md]

**Backend rules that constrain every change:**
- Controllers own initial data fetching; pages are presentational for page data.
  Live room state (playback, presence, chat) is polled via JSON endpoints in
  `routes/web.php` (see §6). [Confirmed — source + docs/SYSTEM.md ch. 18.05]
- Mutations go through a Form Request (authorize + validate) for structured
  input; simple action endpoints may use inline `$request->validate()`
  (e.g. `ChatController::store`). [Confirmed]
- Business logic lives in Actions/Services, never controllers. [Confirmed]
- Every protected controller method calls `$this->authorize()` against a Policy.
  [Confirmed — docs/SYSTEM.md ch. 18.09]
- Unauthorized resources return 404, not 403. [Confirmed]
- No unvalidated `$request->all()` reaching Eloquent. [Confirmed]

---

## 3. Frontend Structure

```
resources/js/
├── app.tsx                      # Inertia entry point (lazy page resolution)
├── Pages/                       # one component per route
│   ├── Welcome.tsx, Dashboard.tsx
│   ├── Auth/                    # login, register, password flows
│   ├── Profile/                 # Edit + Partials
│   └── Rooms/Show.tsx           # the watch-room screen
├── Components/
│   ├── composite/               # domain composites: room-chat, member-list,
│   │                            # subtitle-overlay/settings,
│   │                            # room-settings, confirm-dialog, toast
│   ├── Player/                  # playback surface (Video.js v10): VideoJsPlayer,
│   │                            # SyncedVideoJsPlayer
│   └── ui/                      # primitives: button, input, card, dialog
│   (plus legacy Breeze components: PrimaryButton, TextInput, Modal, Dropdown…)
├── Hooks/                       # use-playback-sync, use-presence, use-toast,
│                                # use-room-ownership, use-suggest-next, use-subtitles
├── Layouts/                     # AppLayout, AuthenticatedLayout, GuestLayout
├── stores/                      # Zustand (UI state only): theme, room-ui, subtitle
├── lib/                         # utils, api, types/
└── types/                       # global/ambient type declarations
```

[Confirmed — directory listing + docs/PROJECT.md; legacy Breeze components
partially confirmed by quality-report.md §5]

**Frontend rules that constrain every change:**
- Pages render initial props; live room data (playback state, presence, chat)
  is polled via dedicated hooks against JSON endpoints — never page-data
  fetching as a workaround for a controller-provided prop. [Confirmed]
- Zustand = local UI state only; server data arrives as Inertia props. [Confirmed]
- Strict TypeScript; no `any` without documented reason. [Confirmed]
- RTL/Persian default; logical properties (`ms-*`, `me-*`) for spacing and
  alignment, with physical positioning only for invariant overlays.
  [Confirmed]

---

## 4. Inertia Communication

- First load: Laravel returns a full HTML document via `resources/views/app.blade.php`.
- Subsequent navigations: Inertia intercepts clicks, sends XHR, receives JSON
  `{ component, props }`, swaps the React page without a full reload.
- Controllers pass exactly the props a page needs, eager-loading relationships
  (`->with()`), never leaking lazy-loaded N+1 queries. [Confirmed — docs/SYSTEM.md
  ch. 18.02]
- Shared props (`auth.user`, `errors`, `flash`) are injected by
  `HandleInertiaRequests` middleware. [Confirmed — FRONTEND_CONTRACT.md §6]
- Slow secondary data can be deferred via `Inertia::defer()`; the `usePollingReload`
  utility no longer exists and there is no full-page Inertia refresh polling.
  Live room data is polled through the axios `api` client against JSON endpoints
  (see §6), not through `router.reload()`. [Confirmed — source + docs/SYSTEM.md ch. 18.05]

---

## 5. React Structure

- React 19 with React Compiler; pages lazy-loaded via Vite glob imports so one
  page's visit does not download every page's JS. [Confirmed — docs/SYSTEM.md]
- Component categories: `ui/` primitives, `composite/` domain composites, pages,
  layouts. [Confirmed]
- State: component-local `useState`/`useReducer`, Zustand for global UI state.
  Server data stays in props. The Room page is the documented exception where
  selected server data is mirrored into `room-ui` store. [Confirmed —
  docs/SYSTEM.md ch. 16.03]

---

## 6. API / Request Flow

There are two route surfaces, with four endpoint categories:

1. **`routes/web.php`** — (a) Inertia page routes carrying initial props,
   (b) JSON polling endpoints (`/playback/{room}/state`, `/presence/{room}`,
   `/chat/{room}/messages`), and (c) JSON action/mutation endpoints (playback
   sync/set-video, chat send/delete, room update/kick/transfer/regenerate/toggle-lock,
   subtitle CRUD, presence heartbeat/leave). All are session-guarded; most require
   `auth, verified`. The app's own UI reaches (b) and (c) via the axios `api`
   client (`resources/js/lib/api.ts`).
2. **`routes/api.php`** — Sanctum-token JSON routes for external consumers.
   Currently only `GET /user` exists; no own-UI route uses this file.

A typical JSON mutation flow (room update via the settings dialog):

```
RoomSettingsDialog (axios api.patch)
  → PATCH /rooms/{room}
  → Route middleware: auth, verified
  → UpdateRoomRequest (authorize: owner-only via Policy; validate: rules)
  → RoomController::update
  → Policy check ($this->authorize('update', $room))
  → Eloquent update
  → JSON response ({ room: updated_room })
```

Inertia-submitted forms (auth pages, Profile partials) instead post through
Inertia's `useForm` and receive field errors via the session; JSON action
endpoints track their own local pending/error state.

A typical JSON read flow (e.g. playback state):

```
usePlaybackSync hook (polling)
  → GET /playback/{room}/state
  → auth, verified middleware
  → PlaybackController::state
  → Policy check: memberAccess
  → JSON response (typed by FRONTEND_CONTRACT / TS types)
```

[Confirmed — FRONTEND_CONTRACT.md, docs/SYSTEM.md]

---

## 7. Database Relationships

```
users
 ├── owner of → rooms (rooms.user_id)
 ├── author of → chat_messages (chat_messages.user_id)
 ├── uploader of → subtitle_tracks (subtitle_tracks.user_id)
 └── member via → room_members (room_members.user_id)

rooms
 ├── belongs to owner (User, user_id)
 ├── has many → room_members
 ├── has many → chat_messages
 └── has many → subtitle_tracks

room_members   belongs to room + user; carries presence fields
chat_messages  belongs to room + user
subtitle_tracks belongs to room + user; stores file_path (internal)
```

Ownership is determined by `room.user_id` — there is no `role` column.
[Confirmed — app/Models/*, FRONTEND_CONTRACT.md §3.3]

---

## 8. Room Lifecycle

```
1. Owner: create room (POST /rooms)  → name + max_members; invite_code generated
2. Share invite link (12-char code)
3. Guests: preview the invite via GET /rooms/join/{inviteCode}, then confirm via
   POST /rooms/join/{inviteCode}
   - GET renders the confirmation page and never creates membership
   - POST checks: room exists, not full (lockForUpdate guard), not locked, not already member
   - join rate limit 10/min
4. Owner sets video URL (POST /playback/{room}/set-video)
   - URL validated for SSRF (UrlSecurityService)
   - playback_mode determined (direct vs proxy)
5. Members watch together — sync via polling
6. Owner controls: lock/unlock, kick, transfer ownership, regenerate invite,
   rename, delete
7. Delete room → DeleteRoomAction (transactional cleanup: members, chat,
   subtitles, subtitle files)
8. Inactive rooms (7+ days) pruned daily
```

[Confirmed — docs/TASK.md, FRONTEND_CONTRACT.md]

---

## 9. Playback Synchronization

The core mechanic. No WebSockets on this host, so:

1. **Write path:** owner changes play/pause/seek → `PATCH /playback/{room}`
   → `Room::updatePlaybackState()` inside a DB transaction with `lockForUpdate()`,
   incrementing `state_version` and stamping `server_timestamp = microtime(true)`.
2. **Event:** `broadcast(new PlaybackStateChanged($room, $userId))` —
   transport-agnostic. With `BROADCAST_CONNECTION=null` this is effectively a no-op
   today; later it pushes over Reverb without changing the feature.
3. **Read path:** every client polls `GET /playback/{room}/state` every 3s
   (playing) or 10s (paused) via `usePlaybackSync`.
4. **Client reconciliation:**
   - Optimistic concurrency: ignore responses where `state_version <= local`.
   - Drift compensation: `expected = position + (now - serverTimestamp) * rate`;
     correct `video.currentTime` when |drift| > 2s.

```
Owner                                          Guests
  │ PATCH /playback/{room}                        │
  │   (DB txn: lock, update, state_version++,     │
  │    server_timestamp)                          │
  │ broadcast(PlaybackStateChanged)  ───────────► │
  │ BROADCAST_CONNECTION=null (no-op today)        │
  │                                               │ poll GET /playback/{room}/state
  │ ◄─────────────────────────────────────────────│ (3s playing / 10s paused)
  │                                               │ reconcile via state_version + drift
```

The frontend reads state only through this flow; **never build room-state
features by directly polling a model** — always go through the Event pattern, so
the future transport swap stays a config change. [Confirmed — docs/SYSTEM.md
ch. 18.05 Rule 3, AGENTS.md]

---

## 10. Video Proxy Flow

When the source does not support CORS `*` + range requests, playback goes through
the server:

```
1. Owner sets video_url → POST /playback/{room}/set-video
2. UrlSecurityService::validateVideoUrl()
   - scheme http/https only
   - hostname blocklist (localhost, .local, .internal, private IP literals…)
   - DNS resolution → block private ranges (RFC 1918, loopback, link-local,
     CGNAT, IPv6 equivalents, DNS rebinding protection)
3. DetermineVideoPlaybackModeAction
   - HEAD request: CORS * + Accept-Ranges: bytes → 'direct'
   - else → 'proxy'
4. Frontend VideoPlayer picks source:
   - direct: video.src = video_url
   - proxy:  video.src = GET /proxy/video/{room}
5. VideoStreamController → VideoProxyService
   - fetchHead / handleRangeRequest / handleFullRequest
   - Range support for seeking; content-type by extension MIME table
   - rate limited (30/min)
```

```
Owner: URL → SSRF validate → playback_mode (direct|proxy) → store on room
Guests: <video> src = video_url (direct)  OR  /proxy/video/{room} (proxy)
        proxy: Laravel fetches external stream → streams bytes to browser
```

**Known accepted risk:** SSRF TOCTOU — DNS is resolved once at the top of the
stream; a DNS rebinding could in theory race between validation and fetch. Window
is microseconds and the proxy requires auth; accepted for MVP. [Confirmed —
docs/TASK.md]

---

## 11. Chat Flow

```
Sender                                           Others
  │ POST /chat/{room}/messages                     │
  │  (body ≤500 chars, throttle 30/min)            │
  │ broadcast(NewChatMessage)  ───────────────────►│
  │  (no-op today — log driver)                    │
  │                                                │ poll GET /chat/{room}/messages
  │ ◄──────────────────────────────────────────────│ every 3s
  │                                                │ (last 50, oldest-first)
  │ DELETE /chat/{room}/messages/{message}         │
  │  (author-only via ChatMessagePolicy)           │
```

[Confirmed — FRONTEND_CONTRACT.md, docs/TASK.md]

---

## 12. Presence Flow

```
Member (every 30s, with exponential backoff up to 5min)
  → POST /presence/{room}/heartbeat   (throttle 60/min)
  → updates room_members.last_seen_at
  → broadcast(MemberPresenceChanged)  (no-op today)

beforeunload → navigator.sendBeacon(POST /presence/{room}/leave)

Scheduled presence:timeout (every minute)
  → members online with last_seen_at older than 90s → marked offline

Others poll GET /presence/{room} every 5s → PresenceMember[]
  (id, user_id, name, presence_status, last_seen_at, is_owner, …)
```

[Confirmed — FRONTEND_CONTRACT.md §5.3, docs/TASK.md]

---

## 13. Subtitle Flow

```
Upload (owner only)
  → POST /subtitles/{room} (multipart: file ≤2MB, srt|vtt|txt, label, language)
  → UploadSubtitleRequest: MIME rule + after() content validation
     (SRT: timing-line format; VTT: WEBVTT header)
  → file stored → SubtitleConverterService converts SRT→VTT (stored as .vtt)
  → SubtitleTrack row created

Read
  → GET /subtitles/{room}            → list of tracks
  → GET /subtitles/{room}/{track}    → raw VTT content
  → GET /subtitles/{room}/{track}/cues → parsed cues (server-side extraction)

Frontend
  → SubtitleOverlay renders active track's cues at current playback time
  → settings (bg opacity, position, RTL) via Zustand + localStorage
```

[Confirmed — FRONTEND_CONTRACT.md §4.16, docs/TASK.md]

---

## 14. Authentication / Authorization Boundaries

```
PUBLIC
 ├── / (Welcome), /login, /register, /forgot-password, /reset-password
 ├── (throttle: login 5/min; verification resend 6/1min)

AUTH (session)
 ├── /confirm-password, /verify-email

AUTH + VERIFIED
 ├── /dashboard, /profile, /rooms/*, /playback/*, /chat/*, /subtitles/*
 ├── /presence/*, /proxy/video/*

OWNER-ONLY (via Policy)
 ├── room update/delete, lock/unlock, kick, transfer, regenerate invite,
 │   set-video, playback update

MEMBER-ONLY (via Policy: memberAccess)
 ├── playback state, chat, subtitles, presence, proxy

API (Sanctum tokens) — routes/api.php, external consumers only
```

Rules enforced: Form Request authorization + `$this->authorize()` in controllers;
404 for unauthorized resources (no existence leakage); session driver database;
secure + same-site cookies. [Confirmed — FRONTEND_CONTRACT.md §6, docs/SYSTEM.md
ch. 18.08/18.09]

---

## 15. Security Boundaries

| Boundary | Mechanism | Status |
|---|---|---|
| SSRF (video URLs) | `UrlSecurityService` — scheme allowlist, hostname blocklist, DNS resolution + private-IP blocking, IPv6 | Confirmed |
| Subtitle uploads | MIME rule + content-format validation (`after()` hook); rejects renamed executables/scripts | Confirmed |
| XSS (subtitles) | `sanitizeText()` strips HTML at subtitle boundaries | Confirmed — quality-report.md §4.3 |
| XSS (chat) | React's default JSX text escaping | Confirmed |
| CSRF | Laravel CSRF token via Inertia; `_token` form field; XSRF-TOKEN cookie plaintext for E2E | Confirmed |
| Security headers | `SecurityHeadersMiddleware`: CSP (nonce-based in production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (prod only) | Confirmed — docs/TASK.md |
| Info leakage | Production exception handler returns generic message; `APP_DEBUG=false` required | Confirmed |
| Rate limiting | Named limiters on all auth + room endpoints: login, register, forgot-password, reset-password (5/min each), chat (30/min), playback (60/min), proxy (30/min), presence (60/min), join (10/min), room-create (5/min), email verification (6/min) | Confirmed |
| Test helpers | `routes/test-helpers.php` — loaded only in `local`/`testing`; double-gated | Confirmed |
| Error monitoring | Sentry, disabled when SENTRY_DSN empty | Confirmed |

---

## 16. Shared-Hosting Constraints

These are not suggestions — they are the environment TamashaRoom runs in and every
feature must fit within them:

- **No Docker, no Redis, no WebSockets, no persistent background workers, no root
  access.** [Confirmed]
- **1 CPU core, 2GB RAM** — the performance budget (SYSTEM.md ch. 21.02). Polling
  intervals must stay in seconds, not milliseconds, and only while relevant UI is
  visible. [Confirmed]
- **One cPanel cron entry** runs `php artisan schedule:run` every minute; all
  other scheduling fans out from `routes/console.php`. [Confirmed]
- **Queue work** is drained by a scheduled `queue:work --stop-when-empty` batch
  (sub-minute background processing is never assumed). [Confirmed]
- **Cache/session/queue** all use database drivers (no Redis). [Confirmed]
- **Node.js 22** is build-time only. [Confirmed]
- **Future migration path:** playback sync moves to Laravel Reverb on a VPS by
  changing `BROADCAST_CONNECTION` — the Event + polling architecture makes this a
  driver swap, not a rewrite. [Confirmed]
