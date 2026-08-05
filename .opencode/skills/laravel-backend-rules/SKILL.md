---
name: laravel-backend-rules
description: Laravel/PHP backend rules for TamashaRoom — controllers own page data, the four endpoint categories, Form Requests vs inline validation, database-backed cache/queue/session, the polling-to-WebSocket pattern, and the single cPanel cron. Use when creating or editing anything under app/Http, app/Models, app/Events, app/Console, app/Actions, app/Services, routes/, or database/migrations.
---

# Laravel Backend Rules

Full detail: `docs/SYSTEM.md`, Chapter 18 (PHP and Laravel Backend Rules).

Every rule here exists because of one fact: **1 CPU core, 2GB RAM, shared
cPanel hosting, no Redis, no persistent workers, no root access.**

## The Hosting Constraint (read this first)

- **No Redis**: cache (`CACHE_STORE=database`), queue (`QUEUE_CONNECTION=database`),
  session (`SESSION_DRIVER=database`) are all database-backed. Never write code
  that assumes Redis, memcached, or a persistent worker.
- **No persistent queue worker**: all background work is synchronous (user is
  waiting) or queued and drained by the scheduled cron tick.
- **Exactly one cPanel cron entry**: `* * * * * php .../artisan schedule:run`.
  Everything else lives in `routes/console.php` (currently: `rooms:prune-inactive
  --days=7` daily, `queue:work --stop-when-empty --max-time=30` every minute,
  `presence:timeout` every minute). Nothing assumes sub-minute background work —
  if a feature seems to need it, redesign the feature.

## Structure: Who Fetches What

- **Controllers own initial page data.** A controller fetches everything a page
  needs for its first render and passes it as Inertia props. React components do
  not fetch their own initial page data with `useEffect` on mount.
- **Exception (deliberate, not a violation):** live room data — playback state
  (`usePlaybackSync`), presence (`usePresence`), chat (`RoomChat`) — is polled on
  mount through the axios `api` client against JSON endpoints in `routes/web.php`.
  That is the transport-agnostic design (see the polling pattern below). Build
  new live-room reads that way; never as a workaround for a prop the controller
  could have passed.
- **Eager-load everything a page needs** in the controller that renders it.
  `Model::preventLazyLoading(! app()->isProduction())` is on in
  `AppServiceProvider::boot()` so N+1 queries throw locally. On one core with no
  Redis, an N+1 is the most common cause of a page timing out under load.
- **Business logic lives in Actions/Services** (`app/Actions/`,
  `app/Services/`), never inline in controllers. Shared cleanup (room deletion)
  is one `DeleteRoomAction` used by both the owner-delete path and the pruner.

## Four Endpoint Categories (route by who's calling)

TamashaRoom's own UI uses `routes/web.php` exclusively:

1. **Inertia page routes** — initial page props.
2. **JSON polling endpoints** — `GET /playback/{room}/state`,
   `GET /presence/{room}`, `GET /chat/{room}/messages` — session auth.
3. **JSON action/mutation endpoints** — playback sync/set-video, chat
   send/delete, room update/kick/transfer, subtitle CRUD, presence
   heartbeat/leave — session auth, axios `api` client, validated.
4. **External API routes** (`routes/api.php`) — Sanctum-token routes for
   mobile/third parties. Currently only `GET /user`.

Rules: every route resolving to a missing/unauthorized resource calls
`abort(404)`, not 403 (see `security-rules`). Group related routes with
middleware; use persistent Inertia layouts so shared UI isn't remounted on
navigation.

(The security lens on which routes are public network boundaries lives in
`security-rules`, see "API Boundary Rules".)

## Mutations & Validation

- Structured multi-field input → **Form Request** with `authorize()` + `rules()`.
- Simple single-field action endpoints → inline `$request->validate()` (e.g.
  `ChatController::store` validates `body => required|string|max:500`).
- Only validated data reaches Eloquent. **No `$request->all()` unvalidated.**
- Inertia-submitted forms use Inertia's `useForm`. JSON action endpoints use the
  axios `api` client with local pending/error state — don't shoehorn those into
  `useForm`.

## Caching (no Redis)

- Cache expensive, slow-changing reads with `Cache::remember()` (database
  driver). Invalidate explicitly with `Cache::forget()` in the same controller
  action that mutates the underlying data — don't rely on TTL alone.
- Run `config:cache`, `route:cache`, `view:cache` on every production deploy.

## The Polling → WebSocket Pattern (critical, TamashaRoom-specific)

Room-wide state (playback sync, presence, any future live feed) is written as a
**Laravel broadcastable Event**, never read via direct polling of a model. The
write path and the event are transport-agnostic:

```php
// app/Events/PlaybackStateChanged.php — implements ShouldBroadcast, broadcasts
// on PresenceChannel("room.{id}") with the current playback state in broadcastWith().
```

```php
// app/Http/Controllers/PlaybackController.php
public function update(UpdatePlaybackRequest $request, Room $room): JsonResponse
{
    $this->authorize('update', $room);
    $room->updatePlaybackState($request->validated() + ['last_activity_at' => now()]);
    broadcast(new PlaybackStateChanged($room, $request->user()->id))->toOthers();
    return response()->json([...]);
}
```

- **Now**: `BROADCAST_CONNECTION=null` — broadcasting is a no-op; the frontend
  polls the room's current state on a tiered cadence — 3 seconds while playing,
  10 seconds while paused/idle (see `use-playback-sync.ts`). Expect ~3s sync
  drift while actively playing.
- **Later** (on a VPS): `BROADCAST_CONNECTION=reverb` — the same
  `broadcast(...)` call now pushes over a WebSocket.
- The frontend hides the transport behind one hook
  (`resources/js/Hooks/use-playback-sync.ts`) so components never know which
  transport is active. The future migration is a config change plus a hook
  rewrite, not a feature redesign.

**Never build new room-state features against direct polling of a model —
always go through the Event.**

## Middleware & Metadata

- Middleware is for cross-cutting concerns only (session checks, locale,
  throttling) — never page-specific data fetching or business logic.
- Every page sets its own `<Head>` title/description (no `metadata` export on
  this stack). Shared defaults live once in `resources/views/app.blade.php`.
- `robots.txt` is a static file in `public/`. There is no sitemap generation —
  no `sitemap:generate` command exists.

## Checklist (from SYSTEM.md 18.11)

- Controller (not page component) fetches initial page data; relationships eager-loaded.
- Missing/unauthorized resources return 404, not 403 (see `security-rules`).
- Expensive reads cached (database driver) and invalidated on the write.
- `config:cache` / `route:cache` / `view:cache` on every deploy.
- Structured input → Form Request; simple action endpoints → inline `validate()`. Never `$request->all()` unvalidated.
- Business logic in Actions/Services, not controllers.
- Anything "live" is polled (axios `api` client against JSON endpoints), never assumed to push.
- Room-wide state written as a broadcastable Event, not polled directly from a model.
- Nothing assumes sub-minute background processing; one cron entry only.
- `APP_DEBUG=false` in production, without exception.
