# Frontend Contract — TamashaRoom

> **Purpose:** This document is the single source of truth for every backend contract the
> frontend depends on. If a route, prop, model field, form field, polling endpoint, or
> constant is not listed here, the backend does not expose it — do not code against it.
>
> **Stack constraints:** The frontend is React 19 + Inertia.js 2 + TypeScript (strict) +
> Tailwind CSS 4. It never fetches its own data on mount — controllers own data fetching.
> The backend is Laravel 13 on shared cPanel hosting (no WebSockets, no Redis).

---

## 1. Routes & Pages

All Inertia page routes. Every page receives `auth.user` via the shared middleware
(see §6). Non-page routes (JSON-only) are also listed for completeness.

### 1.1 Page Routes (`Inertia::render`)

| Route Name | URL | Method(s) | Page Component | Props | Auth |
|---|---|---|---|---|---|
| — | `/` | GET | `Welcome` | `canLogin: bool`, `canRegister: bool`, `laravelVersion: string`, `phpVersion: string` | None (guest) |
| `login` | `/login` | GET | `Auth/Login` | `canResetPassword: bool`, `status: string\|null` | Guest |
| `register` | `/register` | GET | `Auth/Register` | *(none)* | Guest |
| `password.request` | `/forgot-password` | GET | `Auth/ForgotPassword` | `status: string\|null` | Guest |
| `password.reset` | `/reset-password/{token}` | GET | `Auth/ResetPassword` | `email: string`, `token: string` | Guest |
| `password.confirm` | `/confirm-password` | GET | `Auth/ConfirmPassword` | *(none)* | `auth` |
| `verification.notice` | `/verify-email` | GET | `Auth/VerifyEmail` | `status: string\|null` | `auth` |
| `dashboard` | `/dashboard` | GET | `Dashboard` | `rooms: Room[]` (see §3) | `auth`, `verified` |
| `rooms.show` | `/rooms/{room}` | GET | `Rooms/Show` | `room: Room` (with `owner`, `members.user`, `chatMessages.user`) | `auth`, `verified` |
| `profile.edit` | `/profile` | GET | `Profile/Edit` | `mustVerifyEmail: bool`, `status: string\|null` | `auth`, `verified` |

### 1.2 JSON Action Routes (no page render)

#### Auth

| URL | Method | Route Name | Body / Params | Auth |
|---|---|---|---|---|
| `/login` | POST | *(inherits `login`)* | `email: string`, `password: string`, `remember: bool` (optional) | Guest, throttle:login (5/min) |
| `/logout` | POST | `logout` | *(none)* | `auth` |
| `/register` | POST | *(inherits `register`)* | `name: string`, `email: string`, `password: string`, `password_confirmation: string` | Guest |
| `/forgot-password` | POST | `password.email` | `email: string` | Guest |
| `/reset-password` | POST | `password.store` | `token: string`, `email: string`, `password: string`, `password_confirmation: string` | Guest |
| `/confirm-password` | POST | *(inherits `password.confirm`)* | `password: string` | `auth` |
| `/password` | PUT | `password.update` | `current_password: string`, `password: string`, `password_confirmation: string` | `auth` |
| `/email/verification-notification` | POST | `verification.send` | *(none)* | `auth`, throttle:6,1 |

#### Profile

| URL | Method | Route Name | Body | Auth |
|---|---|---|---|---|
| `/profile` | PATCH | `profile.update` | `name: string`, `email: string` | `auth`, `verified` |
| `/profile` | DELETE | `profile.destroy` | `password: string` | `auth`, `verified` |

#### Rooms

| URL | Method | Route Name | Body / Params | Auth |
|---|---|---|---|---|
| `/rooms` | POST | `rooms.store` | `name: string` (required, max:255), `max_members: int` (optional, min:2, max:50) | `auth`, `verified` |
| `/rooms/join/{inviteCode}` | GET | `rooms.join` | URL param `inviteCode: string` (12-char alphanumeric) | `auth`, `verified`, throttle:join (10/min) |
| `/rooms/{room}` | PATCH | `rooms.update` | `name: string` (optional, max:255), `max_members: int` (optional, min:2, max:50) | `auth`, `verified` (owner only) |
| `/rooms/{room}` | DELETE | `rooms.destroy` | *(none)* | `auth`, `verified` (owner only) |
| `/rooms/{room}/kick/{target}` | POST | `rooms.kick` | URL param `target: User.id` | `auth`, `verified` (owner only, cannot kick self) |
| `/rooms/{room}/transfer/{target}` | POST | `rooms.transfer` | URL param `target: User.id` | `auth`, `verified` (owner only) |
| `/rooms/{room}/regenerate-invite` | POST | `rooms.regenerate-invite` | *(none)* | `auth`, `verified` (owner only) |
| `/rooms/{room}/toggle-lock` | POST | `rooms.toggle-lock` | *(none)* | `auth`, `verified` (owner only) |
| `/rooms/{room}/members` | GET | `rooms.members` | *(none)* | `auth`, `verified` (member only) |

#### Playback

| URL | Method | Route Name | Body | Auth |
|---|---|---|---|---|
| `PATCH /playback/{room}` | PATCH | `playback.update` | `is_playing: bool`, `position_seconds: numeric (min:0)`, `duration_seconds: numeric (min:0)`, `playback_rate: numeric` (optional, min:0.25, max:4), `video_url: string\|null` (optional), `client_timestamp: numeric` (optional) | `auth`, `verified`, throttle:playback (60/min) |
| `POST /playback/{room}/set-video` | POST | `playback.set-video` | `video_url: string\|url` (required) | `auth`, `verified`, throttle:playback (60/min) |
| `GET /playback/{room}/state` | GET | `playback.state` | *(none)* — response shape in §5 | `auth`, `verified` |

#### Chat

| URL | Method | Route Name | Body | Auth |
|---|---|---|---|---|
| `GET /chat/{room}/messages` | GET | `chat.index` | *(none)* — returns last 50 messages, reversed (oldest first) | `auth`, `verified` |
| `POST /chat/{room}/messages` | POST | `chat.store` | `body: string` (required, max:500) | `auth`, `verified`, throttle:chat (30/min) |
| `DELETE /chat/{room}/messages/{message}` | DELETE | `chat.destroy` | *(none)* — `message` is ChatMessage id | `auth`, `verified` |

#### Subtitles

| URL | Method | Route Name | Body | Auth |
|---|---|---|---|---|
| `GET /subtitles/{room}` | GET | `subtitles.index` | *(none)* | `auth`, `verified` |
| `POST /subtitles/{room}` | POST | `subtitles.store` | Multipart: `file: File` (required, mimes:srt,vtt, max:2048KB), `label: string` (optional, max:255), `language: string` (optional, max:10, default `"fa"`) | `auth`, `verified` |
| `GET /subtitles/{room}/{track}` | GET | `subtitles.show` | *(none)* — returns raw VTT content | `auth`, `verified` |
| `GET /subtitles/{room}/{track}/cues` | GET | `subtitles.cues` | *(none)* | `auth`, `verified` |
| `DELETE /subtitles/{room}/{track}` | DELETE | `subtitles.destroy` | *(none)* | `auth`, `verified` |

#### Presence

| URL | Method | Route Name | Body | Auth |
|---|---|---|---|---|
| `POST /presence/{room}/heartbeat` | POST | `presence.heartbeat` | *(none)* | `auth`, `verified`, throttle:presence (60/min) |
| `GET /presence/{room}` | GET | `presence.index` | *(none)* | `auth`, `verified` |
| `POST /presence/{room}/leave` | POST | `presence.leave` | *(none)* — also sent via `navigator.sendBeacon` on `beforeunload` | `auth`, `verified` |

#### Proxy

| URL | Method | Route Name | Auth |
|---|---|---|---|
| `GET /proxy/video/{room}` | GET | `proxy.video` | `auth`, `verified`, throttle:proxy (30/min) |

**Authorization notes for proxy:**
- `PATCH /playback/{room}` and `POST /playback/{room}/set-video` require `can('update', $room)` / `can('setVideo', $room)` — owner only.
- `GET /playback/{room}/state`, all `chat/*`, all `subtitles/*`, all `presence/*`, and `GET /proxy/video/{room}` require `can('memberAccess', $room)` — any room member including owner.
- `DELETE /chat/{room}/messages/{message}` requires `can('delete', $message)` — only the message author can delete their own message.

---

## 2. Props per Page

### 2.1 `Welcome` (route `/`)

```typescript
interface WelcomePage {
    auth: AuthUser;                   // shared — see §6
    canLogin: boolean;                // Route::has('login')
    canRegister: boolean;             // Route::has('register')
    laravelVersion: string;           // Application::VERSION
    phpVersion: string;               // PHP_VERSION
}
```

### 2.2 `Auth/Login` (route `GET /login`)

```typescript
interface LoginPage {
    auth: AuthUser;
    canResetPassword: boolean;        // Route::has('password.request')
    status: string | null;            // session('status')
}
```

### 2.3 `Auth/Register` (route `GET /register`)

```typescript
interface RegisterPage {
    auth: AuthUser;                   // null for guests
}
```

### 2.4 `Auth/ForgotPassword` (route `GET /forgot-password`)

```typescript
interface ForgotPasswordPage {
    auth: AuthUser;
    status: string | null;            // session('status')
}
```

### 2.5 `Auth/ResetPassword` (route `GET /reset-password/{token}`)

```typescript
interface ResetPasswordPage {
    auth: AuthUser;
    email: string;                    // $request->email from query string
    token: string;                    // $request->route('token')
}
```

### 2.6 `Auth/ConfirmPassword` (route `GET /confirm-password`)

```typescript
interface ConfirmPasswordPage {
    auth: AuthUser;
}
```

### 2.7 `Auth/VerifyEmail` (route `GET /verify-email`)

```typescript
interface VerifyEmailPage {
    auth: AuthUser;
    status: string | null;            // session('status')
}
```

### 2.8 `Dashboard` (route `GET /dashboard`)

```typescript
interface DashboardPage {
    auth: AuthUser;
    rooms: Room[];                    // see §3.1 for Room shape
    // Each Room in this list is loaded with:
    //   ->with('owner')
    //   ->withCount('members')
    //   ->latest('last_activity_at')
}
```

The queryset: rooms where the user is either the owner or a member.

### 2.9 `Rooms/Show` (route `GET /rooms/{room}`)

```typescript
interface RoomShowPage {
    auth: AuthUser;
    room: RoomFull;                   // see §3.1 for RoomFull shape
    // Loaded with:
    //   ->load(['owner', 'members.user', 'chatMessages.user'])
}
```

### 2.10 `Profile/Edit` (route `GET /profile`)

```typescript
interface ProfileEditPage {
    auth: AuthUser;
    mustVerifyEmail: boolean;         // $request->user() instanceof MustVerifyEmail
    status: string | null;            // session('status')
}
```

---

## 3. Data Models

### 3.1 `Room`

Fields exposed to the frontend (all columns from `rooms` table + loaded relations):

```typescript
interface Room {
    id: number;
    user_id: number;
    name: string;
    invite_code: string;                // 12-char random alphanumeric
    video_url: string | null;
    playback_mode: PlaybackMode;        // 'direct' | 'proxy'
    is_playing: boolean;
    position_seconds: number;
    duration_seconds: number;
    playback_rate: number;
    state_version: number;
    server_timestamp: number | null;    // microtime(true) in float seconds
    max_members: number;                // default 10
    last_activity_at: string | null;    // ISO 8601 datetime
    is_locked: boolean;                 // default false
    created_at: string;                 // ISO 8601
    updated_at: string;                 // ISO 8601
}

// --- Extra fields added by queries ---

interface RoomWithOwner extends Room {
    owner: User;                        // loaded via ->with('owner')
    members_count?: number;             // loaded via ->withCount('members')
}

interface RoomFull extends Room {
    owner: User;                        // the room creator
    members: RoomMember[];              // includes nested user objects
    chatMessages: ChatMessage[];        // includes nested user objects
}
```

### 3.2 `User`

```typescript
interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;   // ISO 8601
    // created_at, updated_at exist but are rarely exposed
}
```

**Note:** `password` and `remember_token` are always hidden from serialization.

### 3.3 `RoomMember`

```typescript
interface RoomMember {
    id: number;
    room_id: number;
    user_id: number;
    is_owner: boolean;                  // computed: member.user_id === room.user_id
    last_seen_at: string;               // ISO 8601
    presence_status: 'online' | 'offline';
    heartbeat_version: number;
    joined_at: string | null;           // ISO 8601
    disconnected_at: string | null;     // ISO 8601
    created_at: string;
    updated_at: string;
    user?: User;                        // loaded when ->with('user') is called
}

// The /presence/{room} endpoint returns a transformed shape (see §5.3):
interface PresenceMember {
    id: number;
    user_id: number;
    name: string;                       // $member->user->name
    presence_status: 'online' | 'offline' | 'away';
    last_seen_at: string;
    disconnected_at: string | null;
    joined_at: string;
    is_owner: boolean;                  // member.user_id === room.user_id
}
```

**Note:** There is no `role` column. Ownership is determined by comparing `user_id` to `room.user_id`. The frontend type `'away'` is not written by the backend — it may be used client-side for UI states.

### 3.4 `ChatMessage`

```typescript
interface ChatMessage {
    id: number;
    room_id: number;
    user_id: number;
    body: string;                       // max 500 chars
    created_at: string;                 // ISO 8601
    updated_at: string;                 // ISO 8601
    user?: {                            // loaded when ->with('user:id,name')
        id: number;
        name: string;
    };
}
```

**`chat.index` response:** Array of `ChatMessage[]` — last 50 messages, oldest-first (reversed from `latest()`).

### 3.5 `SubtitleTrack`

```typescript
interface SubtitleTrack {
    id: number;
    label: string;
    language: string;                   // default 'fa' (ISO 639-1)
    original_extension: string;         // 'srt' | 'vtt'
    created_at: string;
}
```

**Fields NOT exposed:** `room_id`, `user_id`, `file_path` — these are internal.

### 3.6 `SubtitleCue`

```typescript
interface SubtitleCue {
    start: number;                      // milliseconds
    end: number;                        // milliseconds
    text: string;                       // plain text (HTML tags stripped)
}
```

Cues are extracted from VTT content server-side by `SubtitleConverterService::extractCues()`.

### 3.7 `SubtitleSettings`

```typescript
interface SubtitleSettings {
    size: number;                       // default 20
    color: string;                      // hex, default '#ffffff'
    enabled: boolean;                   // default true
    bgOpacity: number;                  // 0-100, default 40
    position: 'bottom' | 'top';        // default 'bottom'
}
```

**Frontend-only** — stored in Zustand (`subtitle` store), not persisted to backend.

---

## 4. Forms & Actions

Every HTTP mutation the frontend must send, with exact field names and validation rules.

### 4.1 Login

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | `string` | Yes | Valid email format |
| `password` | `string` | Yes | Any string |
| `remember` | `boolean` | No | (optional) |

**Route:** `POST /login` (Laravel named `login`)
**Throttle:** 5 attempts per minute per `email|ip`
**Errors:** Returns `{ errors: { email: [...] } }` on failure.

### 4.2 Register

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | Yes | max:255 |
| `email` | `string` | Yes | max:255, lowercase, valid email, unique on `users` table |
| `password` | `string` | Yes | Confirmed (`password_confirmation` required), must pass Laravel password defaults (min:8, mixed case, etc.) |
| `password_confirmation` | `string` | Yes | Must match `password` |

**Route:** `POST /register` (Laravel named `register`)

### 4.3 Forgot Password

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | `string` | Yes | Valid email format |

**Route:** `POST /forgot-password` (Laravel named `password.email`)

### 4.4 Reset Password

| Field | Type | Required | Rules |
|---|---|---|---|
| `token` | `string` | Yes | — |
| `email` | `string` | Yes | Valid email format |
| `password` | `string` | Yes | Confirmed, Laravel password defaults |
| `password_confirmation` | `string` | Yes | Must match `password` |

**Route:** `POST /reset-password` (Laravel named `password.store`)

### 4.5 Confirm Password

| Field | Type | Required | Rules |
|---|---|---|---|
| `password` | `string` | Yes | Must match current password |

**Route:** `POST /confirm-password` (Laravel named `password.confirm`)

### 4.6 Update Password

| Field | Type | Required | Rules |
|---|---|---|---|
| `current_password` | `string` | Yes | Must match current password |
| `password` | `string` | Yes | Confirmed, Laravel password defaults |
| `password_confirmation` | `string` | Yes | Must match `password` |

**Route:** `PUT /password` (Laravel named `password.update`)

### 4.7 Update Profile

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | Yes | max:255 |
| `email` | `string` | Yes | max:255, lowercase, valid email, unique except current user's own email |

**Route:** `PATCH /profile` (Laravel named `profile.update`)

### 4.8 Delete Profile

| Field | Type | Required | Rules |
|---|---|---|---|
| `password` | `string` | Yes | Must match current password |

**Route:** `DELETE /profile` (Laravel named `profile.destroy`)

### 4.9 Create Room

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | Yes | max:255 |
| `max_members` | `integer` | No | min:2, max:50 (default 10) |

**Route:** `POST /rooms` (Laravel named `rooms.store`)
**Server-side validation:** Also checks `config('tamasharoom.max_concurrent_rooms')` (default 50) — rooms with `last_activity_at` within 2 hours count toward the limit.
**Response:** `RedirectResponse` to `rooms.show`

### 4.10 Update Room

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | No (`sometimes`) | max:255 |
| `max_members` | `integer` | No (`sometimes`) | min:2, max:50 |

**Route:** `PATCH /rooms/{room}` (Laravel named `rooms.update`)
**Authorization:** Owner only.

### 4.11 Join Room (via invite code)

| Field | Type | Required | Rules |
|---|---|---|---|
| *(none — invite code is URL param)* | — | — | — |

**Route:** `GET /rooms/join/{inviteCode}` (Laravel named `rooms.join`)
**Throttle:** 10 per minute per user.
**Server-side validation:** `invite_code` must exist in `rooms.invite_code`.
**Authorization:** Room must not be full, must not be locked, user must not already be a member.
**Response:** `RedirectResponse` to `rooms.show`

### 4.12 Set Video

| Field | Type | Required | Rules |
|---|---|---|---|
| `video_url` | `string` | Yes | Valid URL |

**Route:** `POST /playback/{room}/set-video` (Laravel named `playback.set-video`)
**Authorization:** Owner only.
**Throttle:** 60/min (playback bucket).
**Response:** `{ status: 'ok', state_version: number, server_timestamp: number, playback_mode: 'direct' | 'proxy' }`

### 4.13 Update Playback State

| Field | Type | Required | Rules |
|---|---|---|---|
| `is_playing` | `boolean` | Yes | `true`/`false` |
| `position_seconds` | `numeric` | Yes | min:0 |
| `duration_seconds` | `numeric` | Yes | min:0 |
| `playback_rate` | `numeric` | No | min:0.25, max:4 (default 1.0) |
| `video_url` | `string\|null` | No | Valid URL or `null` |
| `client_timestamp` | `numeric` | No | — |

**Route:** `PATCH /playback/{room}` (Laravel named `playback.update`)
**Authorization:** Owner only.
**Throttle:** 60/min (playback bucket).
**Response:** `{ status: 'ok', state_version: number, server_timestamp: number }`

### 4.14 Send Chat Message

| Field | Type | Required | Rules |
|---|---|---|---|
| `body` | `string` | Yes | max:500 |

**Route:** `POST /chat/{room}/messages` (Laravel named `chat.store`)
**Throttle:** 30/min (chat bucket).
**Response (201):** `ChatMessage` (includes nested `user: { id, name }`)

### 4.15 Delete Chat Message

| Field | Type | Required |
|---|---|---|
| *(none — `{message}` is route param)* | — | — |

**Route:** `DELETE /chat/{room}/messages/{message}` (Laravel named `chat.destroy`)
**Authorization:** Message author only (via `ChatMessagePolicy::delete`).
**Response:** `{ status: 'ok' }`

### 4.16 Upload Subtitle

| Field | Type | Required | Rules |
|---|---|---|---|
| `file` | `File` | Yes | Must be a file, mimes:srt,vtt, max:2048 KB. Content is validated — `.srt` files must match SRT timing pattern, `.vtt` files must start with `WEBVTT`. |
| `label` | `string` | No | max:255 (defaults to original filename) |
| `language` | `string` | No | max:10 (default `'fa'`) |

**Route:** `POST /subtitles/{room}` (Laravel named `subtitles.store`)
**Content-type:** `multipart/form-data`

### 4.17 Kick Member

| Field | Type | Required |
|---|---|---|
| *(none — `{target}` is route param)* | — | — |

**Route:** `POST /rooms/{room}/kick/{target}`
**Authorization:** Owner only. Cannot kick self.

### 4.18 Transfer Ownership

| Field | Type | Required |
|---|---|---|
| *(none — `{target}` is route param)* | — | — |

**Route:** `POST /rooms/{room}/transfer/{target}`
**Authorization:** Owner only. Target must be a room member.

### 4.19 Regenerate Invite Code

| Field | Type | Required |
|---|---|---|
| *(none)* | — | — |

**Route:** `POST /rooms/{room}/regenerate-invite`
**Authorization:** Owner only.
**Response:** `{ status: 'ok', invite_code: string }`

### 4.20 Toggle Room Lock

| Field | Type | Required |
|---|---|---|
| *(none)* | — | — |

**Route:** `POST /rooms/{room}/toggle-lock`
**Authorization:** Owner only.
**Response:** `{ status: 'ok', is_locked: boolean }`

### 4.21 Delete Room

| Field | Type | Required |
|---|---|---|
| *(none)* | — | — |

**Route:** `DELETE /rooms/{room}`
**Authorization:** Owner only.
**Response:** `RedirectResponse` to `dashboard`

---

## 5. Real-time / Polling

The application has three independent polling loops. No WebSockets are used in the
current architecture — events are broadcast for future migration but not consumed
by the frontend.

### 5.1 Playback State Polling

**Endpoint:** `GET /playback/{room}/state`
**Hook:** `usePlaybackSync` (`resources/js/Hooks/use-playback-sync.ts`)
**Interval:**
- 3000ms when `is_playing === true`
- 10000ms when `is_playing === false`

**Response shape (PlaybackStateResponse):**

```typescript
interface PlaybackStateResponse {
    is_playing: boolean;
    position_seconds: number;
    duration_seconds: number;
    playback_rate: number;
    video_url: string | null;
    playback_mode: 'direct' | 'proxy';
    state_version: number;
    server_timestamp: number | null;    // microtime(true) as float
    updated_at: string;                 // ISO 8601
}
```

**Optimistic concurrency:** The client tracks `stateVersion` locally and ignores
responses where `state_version <= stateVersion`. This prevents stale data from
overtaking a newer update.

**Drift compensation:** The client computes expected position as:
```
expected = positionSeconds + (clientWallClockNow - serverTimestamp) * playbackRate
```
The `VideoPlayer` component corrects actual `video.currentTime` when drift exceeds
2 seconds.

**Broadcast event (future-use, not consumed by current frontend):**

```typescript
// Event: PlaybackStateChanged — broadcastAs: 'playback.state.changed'
// Channel: PresenceChannel('room.{roomId}')
interface PlaybackStateChangedPayload {
    is_playing: boolean;
    position_seconds: number;
    duration_seconds: number;
    playback_rate: number;
    video_url: string | null;
    state_version: number;
    server_timestamp: number;
    user_id: number;                    // who triggered the change
    updated_at: string;
}
```

### 5.2 Chat Polling

**Endpoint:** `GET /chat/{room}/messages`
**Hook:** Inline in `RoomChat` component (`resources/js/Components/composite/room-chat.tsx`)
**Interval:** 3000ms (configurable via `pollInterval` prop)
**Response shape:** `ChatMessage[]` (see §3.4) — last 50 messages, oldest-first.

**Broadcast event (future-use, not consumed by current frontend):**

```typescript
// Event: NewChatMessage — broadcastAs: 'chat.message.new'
// Channel: PresenceChannel('room.{roomId}')
interface NewChatMessagePayload {
    id: number;
    user_id: number;
    body: string;
    user: { id: number; name: string };
    created_at: string;
}
```

### 5.3 Presence Polling

**Endpoint:** `GET /presence/{room}`
**Hook:** `usePresence` (`resources/js/Hooks/use-presence.ts`)
**Poll interval:** 5000ms (via `setInterval`)
**Heartbeat:** `POST /presence/{room}/heartbeat` every 30000ms (with exponential backoff up to 300000ms). Also triggered immediately on mount.

**Response shape (PresenceMember[]):**

```typescript
interface PresenceMember {
    id: number;                         // RoomMember.id
    user_id: number;
    name: string;
    presence_status: 'online' | 'offline';
    last_seen_at: string;              // ISO 8601
    disconnected_at: string | null;
    joined_at: string;
    is_owner: boolean;
}
```

**Leave on unload:** `POST /presence/{room}/leave` is sent via `navigator.sendBeacon`
in the `beforeunload` event handler.

**Broadcast event (future-use, not consumed by current frontend):**

```typescript
// Event: MemberPresenceChanged — broadcastAs: 'member.presence.changed'
// Channel: PresenceChannel('room.{roomId}')
interface MemberPresenceChangedPayload {
    members: PresenceMember[];
}
```

### 5.4 General Inertia Reload (utility hook)

A helper `usePollingReload(intervalMs)` exists for simple full-page Inertia refreshes
at a fixed interval. Not used for any production feature.

---

## 6. Auth & Session

### 6.1 Shared Inertia Props

Every page receives these props automatically via `HandleInertiaRequests` middleware:

```typescript
interface SharedInertiaProps {
    auth: {
        user: User | null;              // null when not authenticated
    };
    errors: Record<string, string>;     // validation errors (from parent::share)
    flash?: Record<string, string>;     // flash messages (from parent::share)
}
```

### 6.2 `auth.user` Shape

```typescript
interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;   // ISO 8601
}
```

### 6.3 Available Guard Routes

| Check | Expression |
|---|---|
| User is authenticated | `auth.user !== null` or `auth.user !== undefined` |
| User is email-verified | `auth.user.email_verified_at !== null` |
| User owns a room | `room.user_id === auth.user.id` |
| User is room member | Derived from `room.members[].user_id` or presence endpoint |

### 6.4 Route Authentication Middleware

- `guest` routes: Login, Register, Forgot Password, Reset Password.
- `auth` routes: Confirm Password, Verify Email.
- `auth, verified` routes: All room, playback, chat, subtitle, presence, and profile routes.

### 6.5 Broadcast Channel Authorization

The `rooms/{roomId}` PresenceChannel authorizes users who pass the `memberAccess`
policy gate, returning `{ id: number, name: string }`.

---

## 7. Enums & Constants

### 7.1 PlaybackMode

```typescript
type PlaybackMode = 'direct' | 'proxy';
```

| Value | Meaning |
|---|---|
| `'direct'` | Video URL is CORS-friendly and supports range requests — `<video>` loads directly |
| `'proxy'` | Video URL doesn't meet direct-play criteria — proxied through `GET /proxy/video/{room}` |

**Default:** `'proxy'`
**Determined by:** `DetermineVideoPlaybackModeAction` (URL security scan + HEAD request
checking `Access-Control-Allow-Origin` + `Accept-Ranges: bytes`).

### 7.2 PresenceStatus

```typescript
type PresenceStatus = 'online' | 'offline';
```

| Value | Meaning |
|---|---|
| `'online'` | User has sent a heartbeat within 90 seconds |
| `'offline'` | Default; set by leave action or stale timeout (90s without heartbeat) |

**Frontend-only** `'away'` is not written by the backend — may be used client-side.

### 7.3 Stale Timeout

- **Heartbeat stale threshold:** 90 seconds (member marked offline if `last_seen_at` exceeds this without a new heartbeat).
- **Room prune threshold:** 7 days (`PruneInactiveRooms` command runs daily).

### 7.4 Polling Intervals (frontend constants)

| Context | Interval | Mechanism |
|---|---|---|
| Playback sync (playing) | 3000ms | Chained `setTimeout` |
| Playback sync (paused) | 10000ms | Chained `setTimeout` |
| Playback sync debounce | 1000ms | debounce before `sync()` |
| Presence member poll | 5000ms | `setInterval` |
| Presence heartbeat | 30000ms | Chained `setTimeout` |
| Presence heartbeat max backoff | 300000ms (5min) | Exponential backoff |
| Chat message poll | 3000ms | `setInterval` |

### 7.5 Rate Limits

| Named Limiter | Limit | Key |
|---|---|---|
| `chat` | 30 per minute | `user_id` or IP |
| `playback` | 60 per minute | `user_id` or IP |
| `proxy` | 30 per minute | `user_id` or IP |
| `presence` | 60 per minute | `user_id` or IP |
| `login` | 5 per minute | `email\|ip` |
| `join` | 10 per minute | `user_id` or IP |

### 7.6 Subtitle File Constraints

| Rule | Value |
|---|---|
| Allowed extensions | `.srt`, `.vtt` |
| Max file size | 2048 KB (2 MB) |
| Default language | `'fa'` (Persian) |
| Content validation | SRT files must match `HH:MM:SS,mmm --> HH:MM:SS,mmm` timing format on second non-empty line; VTT files must start with `WEBVTT` |

### 7.7 Room Constraints

| Field | Default | Min | Max |
|---|---|---|---|
| `name` | — | 1 char | 255 chars |
| `max_members` | 10 | 2 | 50 |
| `invite_code` | 12-char random alphanumeric | — | — |
| Max concurrent rooms | 50 (`config('tamasharoom.max_concurrent_rooms')`) | — | — |
| Room lock | `false` | — | — |

### 7.8 Playback Constraints

| Field | Min | Max | Default |
|---|---|---|---|
| `playback_rate` | 0.25 | 4.0 | 1.0 |
| `position_seconds` | 0 | — | 0 |
| `duration_seconds` | 0 | — | 0 |

### 7.9 Chat Constraints

| Field | Max |
|---|---|
| `body` | 500 characters |

### 7.10 Broadcast Channel Names

| Channel | Type | Authorization |
|---|---|---|
| `room.{roomId}` | PresenceChannel | Must pass `memberAccess` policy |

### 7.11 Broadcast Event Names

| Event class | `broadcastAs()` |
|---|---|
| `PlaybackStateChanged` | `playback.state.changed` |
| `NewChatMessage` | `chat.message.new` |
| `MemberPresenceChanged` | `member.presence.changed` |

### 7.12 Proxy Video MIME Types

Supported extensions and their MIME types for `GET /proxy/video/{room}`:

| Extension | MIME Type |
|---|---|
| `mp4` | `video/mp4` |
| `webm` | `video/webm` |
| `ogg` | `video/ogg` |
| `mkv` | `video/x-matroska` |
| `mov` | `video/quicktime` |
| `avi` | `video/x-msvideo` |
| `m3u8` | `application/vnd.apple.mpegurl` |
| `ts` | `video/mp2t` |

### 7.13 VideoPlayer Drift Threshold

The `VideoPlayer` component corrects the video element's `currentTime` when
`|video.currentTime - computeExpectedPosition(state, now)| > 2 seconds`.
