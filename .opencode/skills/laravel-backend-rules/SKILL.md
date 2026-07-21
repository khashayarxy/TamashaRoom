---
name: laravel-backend-rules
description: Laravel/PHP backend rules for TamashaRoom — controllers, routes, Eloquent, caching, mutations, scheduled tasks, and the polling-to-WebSocket migration pattern. Use when creating or editing anything under app/Http, app/Models, app/Events, app/Console, routes/, or database/migrations.
---

# Laravel Backend Rules

Full detail: `docs/SYSTEM.md`, Chapter 18 (PHP and Laravel Backend Rules).

Every rule here exists because of one fact: **1 CPU core, 2GB RAM, shared
cPanel hosting, no Redis, no persistent workers, no root access.**

## Structure

- **Controllers own data. Pages are presentational.** A controller fetches
  everything a page needs and passes it as Inertia props. React components
  never fetch their own data with `useEffect` on mount — that adds a
  client-server round trip after an already-empty first render.
- **Eager-load everything a page needs**, in the controller that renders it.
  Never let a component trigger a lazy-loaded Eloquent query while rendering.
  Enable `Model::preventLazyLoading(! app()->isProduction())` in
  `AppServiceProvider::boot()` so N+1 queries throw locally instead of
  silently running. On a single core with no Redis, an N+1 pattern is the
  most common cause of a page timing out under load.
- **Route by who is calling.** TamashaRoom's own UI → Inertia route in
  `routes/web.php`. Anything else (mobile client, third party, webhook) →
  token-authenticated route in `routes/api.php` via Sanctum.
- Group related routes with middleware; use a persistent Inertia layout so
  shared UI (sidebar, header) isn't re-fetched or remounted on navigation.
- Every route that can resolve to a missing/unauthorized resource calls
  `abort(404)` — not 403. A 403 confirms the resource exists; 404 doesn't.

## Caching (no Redis available)

- Cache expensive, slow-changing reads with `Cache::remember()` using the
  **database** cache driver (`CACHE_STORE=database`).
- Invalidate explicitly with `Cache::forget()` in the same controller action
  that mutates the underlying data — don't rely on TTL alone for data the
  user expects to see update immediately.
- Run `config:cache`, `route:cache`, and `view:cache` on every production
  deploy. Skipping this means every request re-parses every config file.

## Mutations & Validation

- Every mutation goes through a **Form Request** with both `authorize()` and
  `rules()` defined. No exceptions. `$request->all()` reaching Eloquent
  unvalidated is an open boundary, not a shortcut.
- Frontend forms use Inertia's `useForm` — don't hand-roll pending/error state.

## The Polling → WebSocket Pattern (critical, TamashaRoom-specific)

Room-wide state (playback sync, presence, any future live feed) is written as
a **Laravel broadcastable Event**, never read via direct polling of a model.
The write path and the event are transport-agnostic:

```php
// app/Events/PlaybackStateChanged.php
class PlaybackStateChanged implements ShouldBroadcast
{
    public function __construct(
        public string $roomId,
        public bool $isPlaying,
        public float $positionSeconds,
    ) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("room.{$this->roomId}");
    }
}
```

```php
// app/Http/Controllers/PlaybackController.php
public function update(UpdatePlaybackRequest $request, Room $room): JsonResponse
{
    $room->update($request->validated());
    broadcast(new PlaybackStateChanged(
        $room->id, $room->is_playing, $room->position_seconds,
    ));
    return response()->json(['ok' => true]);
}
```

- **Now**: `BROADCAST_CONNECTION=log` — broadcasting is a no-op; the frontend
  polls the room's current state every 1-2 seconds instead. Expect ~1-2s sync
  drift — acceptable for the test phase, not frame-accurate.
- **Later** (on a VPS): `BROADCAST_CONNECTION=reverb` — the same
  `broadcast(new PlaybackStateChanged(...))` call now pushes over a WebSocket.
- On the frontend, hide the transport behind one hook
  (`resources/js/hooks/use-playback-sync.ts`) so components never know which
  transport is active. This is the one deliberate exception to keeping
  architecture final — it exists specifically to make the future migration a
  config change plus a hook rewrite, not a feature redesign.

## Middleware & Scheduled Tasks

- Middleware is for cross-cutting concerns only (session checks, locale,
  throttling) — never page-specific data fetching or business logic.
- There is **no persistent queue worker**. All background work either runs
  synchronously in the request (if the user is waiting on it) or is queued to
  the database driver and drained by a scheduled task. The only cPanel cron
  entry is `* * * * * php artisan schedule:run`; everything else is
  registered in `routes/console.php`.
- Nothing assumes sub-minute background processing. If a feature seems to
  need it, redesign the feature for this hosting profile.

## Metadata & SEO

- Every page sets its own `<Head>` title/description — no `metadata` export
  exists on this stack. Shared defaults (viewport, theme-color, title
  fallback) live once in `resources/views/app.blade.php`.
- `sitemap.xml` is generated on a schedule as a static file, never computed
  per request. `robots.txt` is a plain static file, edited directly.

## Room Cap Enforcement (required before launch)

SYSTEM.md 21.10 requires this explicitly: room-based polling is a direct
multiplier on the single-core budget (N rooms × M members × poll interval).
Two caps are needed, not one:

1. **Per-room member cap** — enforce at join time, not just at creation time
   (a room's `max_members` field already exists per TASK.md, but must be
   checked on every join attempt, including races):
   ```php
   // app/Http/Requests/JoinRoomRequest.php
   public function rules(): array
   {
       return [
           'invite_code' => ['required', 'string', 'exists:rooms,invite_code'],
       ];
   }

   public function withValidator(Validator $validator): void
   {
       $validator->after(function (Validator $validator) {
           $room = Room::where('invite_code', $this->invite_code)->first();
           if ($room && $room->members()->count() >= $room->max_members) {
               $validator->errors()->add('invite_code', __('This room is full.'));
           }
       });
   }
   ```
   Run the member-count check inside a DB transaction with a row lock
   (`Room::lockForUpdate()`) at the actual join point to close the race
   where two people join the last slot simultaneously.

2. **System-wide active room cap** — a ceiling on *total concurrent polling
   rooms*, independent of any single room's size, since that's what
   actually bounds requests/second against the one CPU core. Track this
   with a simple cached counter (`Cache::remember('active-rooms-count', ...)`
   invalidated on room create/prune) and reject new room creation past a
   configured threshold (`config('tamasharoom.max_concurrent_rooms')`) with
   a clear user-facing message, not a silent failure.

## Data Cleanup on Room Pruning

`rooms:prune-inactive` (docs/TASK.md) must not leave orphaned data behind —
deleting the `rooms` row alone leaves chat messages and subtitle files on
disk with no owner, silently consuming the 20GB storage cap over time.

```php
// app/Console/Commands/PruneInactiveRooms.php
public function handle(): void
{
    Room::where('updated_at', '<', now()->subDays(7))
        ->chunkById(50, function ($rooms) {
            foreach ($rooms as $room) {
                // Delete subtitle files from disk before the DB rows that
                // reference them, so nothing orphaned survives the delete.
                foreach ($room->subtitles as $subtitle) {
                    Storage::delete($subtitle->file_path);
                }
                $room->subtitles()->delete();
                $room->chatMessages()->delete();
                $room->members()->delete();
                $room->delete();
            }
        });
}
```

Use `chunkById`, not `get()->each()`, so a large batch of stale rooms
doesn't load everything into memory on a 2GB-RAM box at once. Confirm this
same cleanup path also runs when a room is deleted directly by its owner
(the "Delete room" feature in TASK.md) — both paths should call one shared
`DeleteRoomAction`, not duplicate the cleanup logic.

## Smart Video Proxy (Direct First, Proxy Fallback)

The video proxy exists for SSRF-safe access to sources that block direct
client-side playback (CORS restrictions, no `Range` support exposed to the
browser) — it should not be the default path for every video, because
proxying streams every viewer's playback through the single shared CPU
core and its bandwidth cap.

**Decision order, checked once when a video URL is set on a room:**
1. Attempt a `HEAD` request (server-side, through the existing
   `UrlSecurityService` SSRF checks) to see if the source exposes
   permissive CORS headers and `Accept-Ranges: bytes`.
2. If yes → store the URL for **direct client-side playback**; the
   `<video>` element loads it straight from the source, and the server
   proxy is never invoked for that room.
3. If no (CORS-blocked, no Range support, or the HEAD check fails/times
   out) → fall back to the existing proxy path.

```php
// app/Actions/DetermineVideoPlaybackModeAction.php
public function execute(string $url): string
{
    $this->urlSecurity->assertSafe($url); // existing SSRF check, unchanged

    $response = Http::withoutRedirecting()->timeout(3)->head($url);

    $corsOk = str_contains($response->header('Access-Control-Allow-Origin') ?? '', '*')
        || $response->header('Access-Control-Allow-Origin') === config('app.url');
    $rangeOk = $response->header('Accept-Ranges') === 'bytes';

    return $corsOk && $rangeOk ? 'direct' : 'proxy';
}
```

Store the result (`playback_mode`) on the room alongside `video_url` so
this check runs once at set-time, not on every playback request. The
frontend's video player component reads `playback_mode` and either points
`<video src>` directly at the external URL or at the existing
`/rooms/{room}/video-proxy` route.

## Checklist (from SYSTEM.md 18.11)

- Controller (not page component) fetches page data; relationships eager-loaded.
- Every route resolving to a missing/unauthorized resource returns 404.
- Expensive reads cached (database driver) and invalidated on the write.
- `config:cache` / `route:cache` / `view:cache` run on every deploy.
- Mutations use a Form Request with `authorize()` + `rules()`.
- Slow secondary data deferred with `Inertia::defer()`.
- Anything "live" is polled via partial reload, never assumed to push.
- Room-wide state is written as a broadcastable Event, not polled directly from a model.
- Nothing assumes sub-minute background processing.
- `APP_DEBUG=false` in production, without exception.
