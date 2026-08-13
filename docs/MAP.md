# TamashaRoom — Code & Doc Navigation Map

Read this first when exploring TamashaRoom. It maps every subsystem to its
docs chapter, skill, backend code, frontend code, and tests so you can jump
straight to the relevant files instead of browsing directories. The
authoritative spec is `docs/SYSTEM.md` (see its Chapter Index); the
authoritative task state is `docs/TASK.md`. This file only *points*, it never
restates rules.

## Navigation Hierarchy

```
AGENTS.md (invariants, skill table) → docs/MAP.md (this file) →
  one skill (`.skills/`) → one SYSTEM.md chapter → source files
```

## Cross‑Cutting Reference Docs

| Doc | Purpose | Read when |
|---|---|---|
| `docs/SYSTEM.md` | 29-chapter operating rules (use the Chapter Index at top) | any code/design decision |
| `docs/PROJECT.md` | tech stack, directory layout, env vars, scripts | setup, env, build |
| `docs/TASK.md` | done/pending record; **canonical test counts live here** | before assuming something is done/undone |
| `docs/deployment-checklist.md` | production deploy sequence | deploying/preview |
| `docs/MAP.md` | this file | start of any navigation |

## Subsystem Map

### Rooms (create, join, settings, members, owner actions, permissions)
- Docs chapter: SYSTEM 14/15/16/18; skills `laravel-backend-rules`, `react-rules`.
- Backend: `app/Http/Controllers/RoomController.php`, `app/Policies/RoomPolicy.php`,
  `app/Http/Requests/StoreRoomRequest.php` `JoinRoomRequest.php` `UpdateRoomRequest.php`,
  `app/Actions/DeleteRoomAction.php`, `app/Models/*`.
- Frontend: `resources/js/Pages/Rooms/Show.tsx`, `Pages/Rooms/Join.tsx`,
  `Pages/Dashboard.tsx`, `Components/composite/room-card.tsx`,
  `member-list.tsx` `room-settings.tsx` `confirm-dialog.tsx`,
  `Hooks/use-room-ownership.ts`, `stores/room-ui.ts`.
- Tests: `tests/Feature/RoomManagementTest.php`, `tests/e2e/room.spec.ts`,
  `tests/e2e/lock-kick-transfer.spec.ts`.

### Playback Sync (host authority, versioning, drift, direct/proxy mode, end-of-video moment)
- Skill: `laravel-backend-rules` (polling → WebSocket pattern), `react-rules`.
- Backend: `app/Http/Controllers/PlaybackController.php`,
  `app/Events/PlaybackStateChanged.php`, `app/Enums/PlaybackMode.php`,
  `app/Actions/DetermineVideoPlaybackModeAction.php`,
  `app/Http/Requests/UpdatePlaybackRequest.php`, `app/Services/VideoProxyService.php`
  (range/proxy streaming).
- Frontend: `Hooks/use-playback-sync.ts`, `Hooks/use-suggest-next.ts`,
  `Components/Player/SyncedVideoJsPlayer.tsx` (host-only, guest drift, replay +
  suggest-next at video end, autoplay-block overlay, proxy→direct fallback),
  `Components/Player/VideoJsPlayer.tsx` (Video.js v10 shell, `loadSource`
  src changes, Persian i18n), `lib/player-source.ts` (position-preserve
  decision for transport fallbacks), `lib/types/playback.ts`, `lib/api.ts`.
- Tests: `tests/Feature/PlaybackSyncTest.php`, `tests/Feature/VideoStreamTest.php`,
  frontend hook tests for `use-playback-sync`, `videojs-player.test.tsx`,
  `player-source.test.ts`, `use-suggest-next.test.ts`.

### Chat (polled send/list/delete)
- Skill: `laravel-backend-rules`, `security-rules` (validation/inline `$request->validate()`).
- Backend: `app/Http/Controllers/ChatController.php`, `app/Events/NewChatMessage.php`,
  `app/Policies/ChatMessagePolicy.php`.
- Frontend: `Components/composite/room-chat.tsx`, `stores/room-ui.ts`.
- Tests: `tests/Feature/ChatTest.php`, `tests/e2e/chat.spec.ts`.

### Subtitles (upload SRT/VTT, conversion, overlay, settings, room-default track)
- Skill: `typescript-tailwind-rules`, `rtl-and-design-system`, `security-rules`
  (upload hardening).
- Backend: `app/Http/Controllers/SubtitleController.php` (includes
  `default`/`setDefault` room-default endpoints),
  `app/Events/SubtitleDefaultChanged.php`,
  `app/Services/SubtitleConverterService.php`,
  `app/Http/Requests/UploadSubtitleRequest.php`.
- Frontend: `Components/composite/subtitle-overlay.tsx` `subtitle-settings.tsx`,
  `stores/subtitle.ts`, `lib/types/subtitle.ts`, `lib/subtitle-selection.ts`.
- Tests: `tests/Feature/SubtitleTest.php`, `tests/Unit/SubtitleConverterTest.php`,
  `tests/e2e/subtitle.spec.ts`.

### Presence & Heartbeat (online/offline, timeout, reconnect, join/leave moments)
- Skill: `laravel-backend-rules` (presence event), `debugging` (timing constants).
- Backend: `app/Http/Controllers/PresenceController.php`,
  `app/Services/PresenceService.php`, `app/Events/MemberPresenceChanged.php`,
  `app/Console/Commands/MarkStaleMembersOffline.php`.
- Frontend: `Hooks/use-presence.ts`, `lib/presence-moments.ts` (client-side
  join/leave moment derivation), `Components/composite/member-list.tsx`,
  `Components/composite/room-chat.tsx` (renders moments as system rows).
- Tests: `tests/Feature/PresenceTest.php`, `tests/Unit/PresenceServiceTest.php`,
  `tests/e2e/presence-moments.spec.ts`, `resources/js/__tests__/presence-moments.test.ts`,
  `resources/js/__tests__/use-presence.test.tsx`.

### Room Lifecycle & Scheduled Tasks (prune inactive)
- Backend: `app/Console/Commands/PruneInactiveRooms.php`, `app/Actions/DeleteRoomAction.php`
  (shared by owner-delete + pruner).
- Doc: `docs/deployment-checklist.md` §4 (Background Work) / §5 (Scheduled Tasks).

### Auth / Profile
- Backend: `app/Http/Controllers/ProfileController.php`, Auth controllers under
  `app/Http/Controllers/Auth/`, `app/Http/Requests/ProfileUpdateRequest.php`.
- Frontend: `Pages/Auth/*`, `Pages/Profile/*`, Layouts.
- Tests: `tests/Feature/ProfileTest.php`, `tests/Feature/Auth/` (18), `tests/e2e/*`,
  `tests/a11y/auth-a11y.spec.ts`.

### Security (headers, SSRF, upload, rate limiting, info leakage)
- Skill: `security-rules`.
- Backend: `app/Services/UrlSecurityService.php`,
  `app/Http/Middleware/SecurityHeadersMiddleware.php`,
  named rate limiters in `app/Providers/AppServiceProvider.php`.
- Tests: `tests/Feature/SecurityTest.php`, `tests/Unit/UrlSecurityServiceTest.php`,
  `tests/Feature/RateLimiterTest.php`.

## Test Location Index

| Suite | Command | Root |
|---|---|---|
| PHPUnit Feature | `php artisan test` | `tests/Feature/` |
| PHPUnit Unit | `php artisan test` | `tests/Unit/` |
| Vitest | `npm run test` | `resources/js/__tests__/` |
| Playwright E2E | `npm run test:e2e` | `tests/e2e/` |
| A11y (axe) | `npm run test:a11y` | `tests/a11y/` |

**Canonical test counts:** live in `docs/TASK.md` only. Skills reference it;
do not hardcode counts elsewhere.
