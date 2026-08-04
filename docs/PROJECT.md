# PROJECT.md
# TamashaRoom Project Specification
# Version: MVP
# Last Updated: 2026-08-02

---

## Project Overview

**Name**: TamashaRoom
**Stage**: MVP
**Purpose**: A synchronized watch-party platform for Iranian users — multiple people watch a video together from different locations, with playback kept in sync, so it feels like watching together in person rather than separately.
**Primary language**: Persian (RTL) — the only MVP language
**Deployment**: Shared cPanel hosting (Apache, PHP 8.4, MySQL/MariaDB, 2GB RAM, 1 CPU core, 20GB storage) for the MVP/test phase; see "Real-Time Architecture" below for the planned migration path.
**Design system**: The authoritative design-system document is `design-systems/tamasharoom/DESIGN.md` (draft status — confirm before implementing on any page). There is no `docs/DESIGN.md` or root-level `DESIGN.md`; PRODUCT.md's bare "DESIGN.md" reference was corrected to point here.

## Core Concept

A user creates a private room and provides a video source (an external link — TamashaRoom does not store or host video files). They share an invite link with friends; anyone with the link joins the same room, and playback stays synchronized for everyone in it.

## MVP Features

- Create a private watch room
- Join a room via invite link
- Synchronized playback across all room members: play, pause, seek, current position
- Room member list (who is currently present)
- Simple in-room chat
- Soft subtitle support, with adjustable size and color
- Subtitle differentiation — per-track selection by guests, a host-set room-default track inherited by members, and a per-user local time offset (Phase 13)
- External video links only — no video files stored on the server

## Real-Time Architecture

Playback sync is the product's core mechanic, and it is normally built on WebSockets — which the MVP's shared cPanel hosting does not support (see "Tech Stack" below). For the test/MVP phase:

- Playback state changes are written as a Laravel broadcastable Event (`PlaybackStateChanged`); the frontend polls for it every 3 seconds while playing (10 seconds when paused) — see `resources/js/Hooks/use-playback-sync.ts` and Chapter 18.05, Rule 2. Expect roughly 1–2 seconds of sync drift between members — acceptable for early testing, not frame-accurate.
- The write path and the event are deliberately transport-agnostic (Chapter 18.05, Rule 3): moving to real-time later is a `BROADCAST_CONNECTION` config change plus a Laravel Reverb install on a VPS, not a feature rewrite. No component that reads room state needs to change.
- **Do not build new room-state features against direct polling of a model.** Always go through the Event, so the future migration stays a driver swap.

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Backend Framework | Laravel | 13.20.0 (^13.8) | Routing, ORM (Eloquent), auth, validation, scheduling |
| Backend Language | PHP | 8.4 | Runs as PHP-FPM under Apache (shared cPanel hosting) |
| Frontend Bridge | Inertia.js | `@inertiajs/react` 2.x (client) + `inertiajs/inertia-laravel` 3.1.x (server) | Server-driven SPA — no separate REST layer for the app's own UI |
| Frontend Framework | React | 19.x | UI components, rendered via Inertia |
| Frontend Language | TypeScript | 5.x | Type safety, strict mode |
| Build Tool | Vite | 5.x | Frontend bundling; Node.js 22 is used only at build time, never at runtime |
| Compiler | React Compiler | stable | Automatic memoization, wired through Vite's React plugin |
| Database | MySQL/MariaDB | 8.x/10.x | Primary data store |
| Styling | Tailwind CSS | 4.x | Utility-first CSS; logical properties for RTL |
| UI Components | Headless UI (@headlessui/react) | 2.x | Accessible primitives; Modal, Dropdown, Transition |
| State (Client) | Zustand | 5.x | Local UI state only (`theme`, `room-ui`, `subtitle`) |
| Forms | Inertia `useForm` | built-in | Form state, pending, and server-validated errors |
| Validation (Server) | Laravel Form Requests | built-in | Authoritative validation and authorization |
| Validation (Client) | Zod | 4.x | Client-side pre-validation UX only |
| Testing (Backend) | PHPUnit | 12.x | Laravel feature and unit tests (class-based) |
| Testing (Frontend) | Vitest | 3.x | Unit tests |
| Testing (Frontend) | React Testing Library | 16.x | Component tests |
| Testing (E2E) | Playwright | 1.x | E2E tests |
| Testing (A11y) | @axe-core/playwright | latest | Automated accessibility audits in E2E |
| Linting (JS/TS) | ESLint | 9.x | Flat config, no framework-specific preset |
| Linting (PHP) | Laravel Pint | latest | PHP code style |
| Formatting | Prettier | 3.x | JS/TS/CSS formatting |
| Real-time (planned, post-MVP) | Laravel Reverb + Laravel Echo | — | WebSocket transport for playback sync, once migrated off shared hosting to a VPS with root access. **Not installed for the MVP** — see "Real-Time Architecture" above and SYSTEM.md 18.05, Rule 3. |

**Deployment target**: shared cPanel hosting — Apache, PHP 8.4, MySQL/MariaDB, 2GB RAM, 1 CPU core, 20GB storage. No Docker, no Redis, no WebSockets, no persistent background workers, no root access. See SYSTEM.md, Chapter 18, for the full rationale and the rules this constrains.

**Zustand stores** (all in `resources/js/stores/`; local UI state only — server data is not stored in Zustand):
- `theme` — dark/light mode toggle, persisted to `localStorage`.
- `room-ui` — Room-page UI state (active tab, modal/dialog visibilities, video URL, room name, invite code, locked flag, reactive `ownerId`). The one documented exception where selected server data (`video_url`, `room_name`, `invite_code`, `is_locked`, plus `ownerId` for ownership) is copied into the store to avoid prop drilling; see SYSTEM.md 16.03.
- `subtitle` — subtitle settings (size, color, enabled, bg opacity, position, offset), persisted to `localStorage`.

## Architecture Principles

1. **Controllers own data, pages are presentational**. A Laravel controller fetches everything a page needs and passes it as Inertia props; components render props, they do not fetch their own *initial page* data. **The one deliberate exception:** live room data (playback state, presence, chat) is polled on mount through dedicated hooks (`usePlaybackSync`, `usePresence`, `RoomChat`) using the shared axios `api` client (`resources/js/lib/api.ts`) against session-authenticated JSON endpoints in `routes/web.php` — that is the approved transport-agnostic polling design (SYSTEM.md 18.05, Rule 2), not a violation.
2. **Co-locate related code (preferred organization, not a hard rule)**. As a general pattern, group one controller, one Form Request, and one Inertia page per resource; React components by feature under `resources/js`. This is a helpful default for organizing related code — simple action endpoints may legitimately use inline `$request->validate()` (e.g. `ChatController::store`) instead of a dedicated Form Request, and JSON action endpoints submit through the axios `api` client rather than Inertia forms. Use judgment: the pattern is a preference, not an architectural mandate.
3. **Prefer composition over inheritance**. Components compose, they do not extend.
4. **Keep business logic out of components — and out of controllers**. Use Laravel Actions/Services for anything beyond orchestrating a request; use custom hooks and utilities on the frontend.
5. **Every async operation has explicit states**. Loading, error, success, empty.
6. **Type safety is non-negotiable on both sides of the PHP/TypeScript boundary**. Strict TypeScript, no `any`; a Laravel API Resource and its TypeScript type are kept in sync deliberately, since nothing enforces that automatically across a language boundary.
7. **Design within the hosting budget, not around it**. No feature assumes Docker, Redis, WebSockets, a persistent worker, or horizontal scaling as a fallback.
8. **RTL and dark mode are the default, not an overlay**. Persian (RTL) is the only MVP language; every screen is designed and reviewed in both light and dark mode from the start.

## Directory Structure

```
app/
├── Actions/                        # Business logic — single-responsibility action classes
│   ├── DeleteRoomAction.php
│   └── DetermineVideoPlaybackModeAction.php
├── Console/
│   └── Commands/                   # Scheduled tasks
│       ├── PruneInactiveRooms.php
│       └── MarkStaleMembersOffline.php   # signature: presence:timeout
├── Enums/
│   └── PlaybackMode.php
├── Events/
│   ├── MemberPresenceChanged.php   # broadcastable — polled today, pushed later (SYSTEM.md 18.05)
│   ├── NewChatMessage.php
│   └── PlaybackStateChanged.php
├── Http/
│   ├── Controllers/
│   │   ├── ChatController.php
│   │   ├── PlaybackController.php
│   │   ├── PresenceController.php
│   │   ├── ProfileController.php
│   │   ├── RoomController.php
│   │   ├── SubtitleController.php
│   │   ├── VideoStreamController.php
│   │   └── Auth/                   # Login, register, password reset, verification
│   ├── Middleware/
│   │   ├── HandleInertiaRequests.php
│   │   └── SecurityHeadersMiddleware.php
│   └── Requests/                   # Form Requests — validation + authorization
│       ├── JoinRoomRequest.php
│       ├── ProfileUpdateRequest.php
│       ├── StoreRoomRequest.php
│       ├── UpdatePlaybackRequest.php
│       ├── UpdateRoomRequest.php
│       └── UploadSubtitleRequest.php
├── Models/
│   ├── ChatMessage.php
│   ├── Room.php
│   ├── RoomMember.php
│   ├── SubtitleTrack.php
│   └── User.php
├── Policies/                       # Authorization: can this user act on this resource
│   ├── ChatMessagePolicy.php
│   └── RoomPolicy.php
├── Providers/
│   └── AppServiceProvider.php      # Rate limiters, Vite prefetch
└── Services/                       # Domain services
    ├── PresenceService.php
    ├── SubtitleConverterService.php
    ├── UrlSecurityService.php
    └── VideoProxyService.php

routes/
├── web.php                         # Inertia routes (the app's own UI) + live-room JSON endpoints
├── api.php                         # Sanctum-authenticated JSON routes (external consumers)
├── auth.php                        # Auth routes (login, register, password, verification)
├── channels.php                    # Broadcast channel authorization
├── console.php                     # Scheduled tasks — the only cron entry fans out from here
└── test-helpers.php                # Test-only routes — loaded only in local/testing

database/
├── migrations/
└── seeders/

resources/
├── css/
│   ├── app.css                     # Tailwind imports
│   └── fonts.css                   # @font-face — Vazirmatn
├── js/
│   ├── __tests__/                  # Component and unit tests (Vitest)
│   ├── app.tsx                     # Inertia entry point
│   ├── bootstrap.ts                # axios defaults (X-Requested-With) loaded by app entry
│   ├── Components/
│   │   ├── composite/              # Domain-specific composites
│   │   │   ├── confirm-dialog.tsx
│   │   │   ├── member-list.tsx
│   │   │   ├── room-chat.tsx
│   │   │   ├── room-onboarding.tsx
│   │   │   ├── room-settings.tsx
│   │   │   ├── subtitle-overlay.tsx
│   │   │   ├── subtitle-settings.tsx
│   │   │   ├── toast.tsx
│   │   │   └── video-player.tsx
│   │   └── ui/                     # Primitive components (custom, Tailwind-styled)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── error-boundary.tsx
│   │       └── input.tsx
│   ├── Hooks/                      # Custom React hooks
│   │   ├── use-playback-sync.ts    # today: polling; later: Echo ─ same return shape (SYSTEM.md 18.05)
│   │   ├── use-presence.ts         # presence poll/heartbeat + client-side join/leave moments (O4)
│   │   ├── use-room-ownership.ts
│   │   ├── use-subtitles.ts        # subtitle fetch/upload/delete/default/select orchestration
│   │   ├── use-suggest-next.ts     # next-video suggestion via the chat mechanism (O6)
│   │   └── use-toast.ts
│   ├── Layouts/
│   │   ├── AppLayout.tsx           # Persistent Inertia layout
│   │   ├── AuthenticatedLayout.tsx
│   │   └── GuestLayout.tsx
│   ├── lib/
│   │   ├── api.ts                  # axios instance for JSON endpoints (web.php)
│   │   ├── presence-moments.ts     # pure derivePresenceMoments(prev, next) diff (O4)
│   │   ├── subtitle-selection.ts   # per-room active-track persistence in localStorage
│   │   ├── types/                  # Shared TypeScript types — playback.ts, subtitle.ts
│   │   ├── utils.ts                # cn(), toPersianDigits, formatDuration, timeAgo, safeCopyToClipboard, sanitizeText
│   │   └── (SRT/VTT parsing lives in Components/composite/subtitle-overlay.tsx — parseVtt/parseSrt/parseSubtitle)
│   ├── Pages/                      # One Inertia page component per route
│   │   ├── Auth/                   # Login, register, password reset, verification
│   │   ├── Profile/
│   │   │   └── Edit.tsx
│   │   ├── Rooms/
│   │   │   └── Show.tsx            # the watch-room screen itself
│   │   ├── Dashboard.tsx
│   │   └── Welcome.tsx
│   ├── stores/                     # Zustand stores (local UI state only)
│   │   ├── room-ui.ts
│   │   ├── subtitle.ts
│   │   └── theme.ts
│   └── types/                      # Ambient type declarations
│       ├── global.d.ts
│       ├── index.d.ts
│       └── vite-env.d.ts
└── views/
    ├── app.blade.php               # Root template Inertia renders into
    └── errors/
        ├── 404.blade.php
        └── 500.blade.php

public/
├── build/                          # Vite output — fingerprinted, cached forever
├── fonts/
└── robots.txt
```

## Environment Variables

```bash
# Application
APP_NAME=TamashaRoom
APP_ENV=production
APP_KEY=                      # php artisan key:generate
APP_DEBUG=false                # non-negotiable in production — see SYSTEM.md 18.08, Rule 6
APP_URL=https://yourdomain.com  # production domain not finalized — set to the real one (deployment-checklist.md uses this placeholder)
APP_LOCALE=fa                  # Persian — the only MVP locale

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=

# Cache, session, and queue — no Redis available, so all three use
# drivers backed by MySQL or the filesystem (see SYSTEM.md 18.03, 18.07, 18.09)
CACHE_STORE=database
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
QUEUE_CONNECTION=database

# Broadcasting — no WebSocket server on this host, and nothing currently
# consumes the broadcast events (the frontend polls instead), so this is `null`
# to avoid writing every event to the log. Change to
# BROADCAST_CONNECTION=reverb only after migrating to a VPS.
BROADCAST_CONNECTION=null

# Capacity ceiling — system-wide active-room cap (config/tamasharoom.php)
TAMASHAROOM_MAX_CONCURRENT_ROOMS=50

# Logging — production uses `daily` (rotated, 14-day retention); the local
# development template in .env.example ships `stack`/`single`.
LOG_CHANNEL=daily

# Error monitoring — leave empty to disable (config/sentry.php)
SENTRY_DSN=
```

There is no `NEXT_PUBLIC_*` prefix convention on this stack — Laravel exposes only what a controller explicitly passes as an Inertia prop or a Blade variable; nothing is exposed to the client by naming convention alone.

## Scripts

```bash
# Development
php artisan serve        # Laravel dev server
npm run dev               # Vite dev server (HMR for the React frontend)

# Building (production deploy)
npm run build              # Compile frontend assets with Vite
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Quality
npm run lint              # ESLint
npm run lint:fix          # ESLint with fixes
npm run format             # Prettier format
npm run format:check       # Prettier check (not part of CI)
npm run type-check         # TypeScript check
./vendor/bin/pint          # PHP formatting (Laravel Pint)

# Testing
npm run test               # Unit tests (Vitest)
npm run test:e2e           # E2E tests (Playwright)
npm run test:a11y          # Accessibility audit (@axe-core/playwright)
php artisan test            # Backend feature/unit tests (PHPUnit)

# Database
php artisan migrate
php artisan db:seed

# Scheduled tasks — the one cPanel cron entry this project needs
# * * * * * php /home/tamasharoom/artisan schedule:run >> /dev/null 2>&1
```

## Current Status

Framework initialization complete.
All 29 chapters of SYSTEM.md are written.
Chapters 21 (Performance), 22 (Accessibility), and 23 (SEO) were audited and updated on 2026-07-18 for React Compiler, INP, WCAG 2.2, and Next.js 15 caching/runtime guidance.
Chapters 24–29 (Error Handling, Review Engine, Refactoring, Anti Patterns, Output Rules, Final Checklist) were audited on 2026-07-18 for global-error.tsx/not-found.tsx, React 19 Actions, instrumentation.ts, ESLint flat config, and consistency with the Chapter 21–23 changes; Chapter 26 required no changes.
A final full-document consistency pass (all 29 chapters plus PROJECT.md and TASK.md) was completed on 2026-07-18: fixed broken cross-references (including a missing 06.11 concept, now added), corrected mis-numbered chapter references, resolved a conflicting memoization recommendation in Chapter 17 (React Rules) that predated the Chapter 21 React Compiler update, and synchronized file naming and status reporting across all three documents.
**On 2026-07-20, the entire stack was re-architected for the official deployment environment (shared cPanel hosting — no Docker, Redis, WebSockets, background workers, or root access).** Next.js was replaced end-to-end by PHP 8.4 + Laravel + Inertia.js + React 19 + Vite, with Node.js 22 used only as a build-time tool. Chapter 18 (Next.js Rules) became Chapter 18 (PHP and Laravel Backend Rules); Chapters 16, 17, 19, 21, 23, 24, 27, 28, and 29 were updated for consistency with it. Persian (RTL) typography (SYSTEM.md 11.08) and a first-release dark mode requirement (SYSTEM.md 12.04) were also added. This file (tech stack, directory structure, environment variables, scripts) was updated to match; see TASK.md for the itemized change log and the resulting implementation tasks.
**Also on 2026-07-20, the actual product was defined**: TamashaRoom is a synchronized watch-party platform (private rooms, invite links, synced play/pause/seek, member presence, in-room chat, soft subtitles, external video links only — no server-side storage). Because playback sync is the product's core mechanic and normally requires WebSockets, which the MVP hosting does not support, SYSTEM.md 18.05 gained a new Rule 3 (and 21.10 a new item 5): playback state is written as a Laravel broadcastable Event and delivered by polling for now, with the transport swappable to Laravel Reverb on a future VPS without a feature rewrite. See "Real-Time Architecture" above.
**On 2026-07-21, five launch-blocker and deployment tasks were completed**: (1) per-room member cap with `lockForUpdate()` race guard and system-wide active-room ceiling via `config/tamasharoom.php`; (2) shared `DeleteRoomAction` for data cleanup on room deletion, used by both `rooms:prune-inactive` and the owner-initiated delete path; (3) `DetermineVideoPlaybackModeAction` that detects CORS+Range support and switches between direct client-side playback and the server proxy; (4) `.github/workflows/ci.yml` running Pint, ESLint, TypeScript, Vite build, and PHPUnit tests on SQLite `:memory:`; (5) Sentry error monitoring (`sentry/sentry-laravel` package installed, `config/sentry.php` published). A comprehensive security audit was also completed, fixing a critical transaction gap in `DeleteRoomAction`, a prune-query bug that could delete freshly-created rooms, adding a `rooms.last_activity_at` index, creating an `App\Enums\PlaybackMode` backed enum, fixing RTL property usage, translating user-facing error messages to Persian, adding rate limiters, and adding integration coverage for the join race condition.

**On 2026-07-22, documentation was synchronized with the actual codebase**: stack references changed from Radix/Pest to Headless UI/PHPUnit; removed stale `pestphp/pest-plugin` from `composer.json`; removed unused `zod-validation-error` from `package.json`; installed `laravel/sanctum`, `zustand`, `zod`, `vitest`, `prettier`, and `@testing-library/react` as missing dependencies; added `type-check`, `format`, `test`, `test:e2e`, `test:watch` scripts; created `vitest.config.ts` and Playwright E2E config; added a placeholder Vitest test suite awaiting real test cases.

See SYSTEM.md for operational guidelines.
See TASK.md for active work items.
