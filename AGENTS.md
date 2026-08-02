# TamashaRoom — Agent Instructions

This file is always loaded into context. Keep it short. Deep-dive rules live in
`.opencode/skills/` and are loaded on demand — see "Available Skills" below.
The full source of truth is `docs/SYSTEM.md` (29 chapters; chapter→line index
at its top). `docs/MAP.md` maps every subsystem to its docs chapter, skill,
and source files — read it before exploring code. `docs/PROJECT.md` (tech
stack, directory layout, env vars) and `docs/TASK.md` (what's done, pending;
canonical test counts) are the other reference docs. Skills summarize these
documents; if a skill and SYSTEM.md ever disagree, SYSTEM.md wins.

## What This Project Is

TamashaRoom is a synchronized watch-party platform for Persian-speaking users.
Someone creates a private room, shares an invite link, and everyone in the room
watches an external video together with playback kept in sync — play, pause,
seek, position. No video files are stored on the server; only external links
are supported. MVP language is Persian (RTL) only.

## Stack

Laravel 13 (PHP 8.4) + Inertia.js 2 + React 19 + TypeScript (strict) + Vite 5 +
MySQL/MariaDB + Tailwind CSS 4 + Headless UI (@headlessui/react) + Zustand (UI state only)
+ PHPUnit (backend tests) + Vitest/RTL/Playwright
(frontend tests).

## The One Constraint That Shapes Everything

**Deployment target is shared cPanel hosting: Apache, PHP 8.4, MySQL, 2GB RAM,
1 CPU core, 20GB storage. No Docker, no Redis, no WebSockets, no persistent
background workers, no root access.**

Playback sync (the product's core mechanic) would normally use WebSockets.
Instead: state changes are written as a Laravel broadcastable Event, and the
frontend polls for it every 3 seconds (adjustable post-MVP). This is deliberate and transport-agnostic
— moving to real-time later means installing Laravel Reverb on a VPS and
flipping `BROADCAST_CONNECTION`, not rewriting the feature. **Never build new
room-state features against direct polling of a model — always go through the
Event**, so the future migration stays a driver swap. See the
`laravel-backend-rules` skill for the full pattern.

## Non-Negotiable Rules

- No feature may assume Docker, Redis, WebSockets, a persistent worker, or
  horizontal scaling as a fallback. Design within the hosting budget.
- Controllers own initial data fetching. Pages/components are presentational for
  page data — they render props and don't fetch their own page data on mount.
  The exception: live room data (playback state, presence, chat) is deliberately
  polled through dedicated hooks (`usePlaybackSync`, `usePresence`, `RoomChat`)
  via the axios `api` client against JSON endpoints in `routes/web.php`. That is
  the transport-agnostic polling design, not a violation.
- Strict TypeScript on the frontend. On the backend, structured input is
  validated by Form Requests; simple action endpoints may use inline
  `$request->validate()` (e.g. `ChatController::store`). No `any` without a
  documented reason. No `$request->all()` reaching Eloquent unvalidated.
- Persian (RTL) and dark mode are the default, not an overlay. Use Tailwind's
  logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`),
  never physical ones (`ml-*`, `mr-*`, `pl-*`, `pr-*`).
- Business logic lives in Laravel Actions/Services and frontend hooks — never
  directly in controllers or components.
- Every async operation has explicit loading, error, success, and empty states.
- No `console.log`, no commented-out code, no TODO without a ticket reference.

## Commands

```bash
# Development
php artisan serve          # Laravel dev server
npm run dev                # Vite dev server (HMR)

# Quality — run before considering any change done
npm run lint                # ESLint
npm run type-check          # TypeScript strict check
npm run format               # Prettier (write)
npm run format:check         # Prettier check (read-only)
./vendor/bin/pint            # PHP formatting (Laravel Pint)

# Testing
npm run test                 # Frontend unit tests (Vitest)
npm run test:e2e             # E2E (Playwright)
npm run test:a11y            # Accessibility audit (@axe-core/playwright)
php artisan test              # Backend feature/unit tests (PHPUnit)

# Database
php artisan migrate
php artisan db:seed

# Production build (see docs/PROJECT.md for the full deploy sequence)
npm run build
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

## Keep docs/TASK.md in Sync

`docs/TASK.md` is the **single, canonical** record of what's done and what's
pending for this project — not a root-level `TASK.md`. If a root-level
`TASK.md` exists or gets created, treat it as legacy/scratch only; **do not
read from it or write to it**. All task tracking, past and future, reads
from and writes to `docs/TASK.md` exclusively. **When you finish a unit of
work, update `docs/TASK.md`** — move the item from "Pending" to "Completed,"
or add a new line under the right section if it wasn't tracked yet. Don't
leave it to drift; a stale TASK.md is worse than none, because it actively
misleads the next session (including your own).

## Available Skills

Skills are loaded automatically when relevant. You generally don't need to
reference them by name — just describe the task.

| Skill | Load it when working on... |
|---|---|
| `mvp-scope-decisions` | A new feature request, a new dependency, or anything that might expand scope — check this *before* writing code |
| `laravel-backend-rules` | Controllers, models, Events, routes, caching, queues, the polling/broadcast pattern, Actions/Services |
| `react-rules` | Components, hooks, state, component architecture/categories, where state lives, React Compiler-aware performance |
| `typescript-tailwind-rules` | Types, Zod schemas, Tailwind classes, `cn()`, dark mode |
| `rtl-and-design-system` | Layout, typography, color, RTL/Persian-specific UI, motion |
| `accessibility-rules` | Any interactive UI, forms, modals, WCAG 2.2 compliance |
| `security-rules` | Auth, API routes, file uploads, SSRF, anything reachable from outside TamashaRoom's own UI |
| `performance-rules` | Anything touching load time, bundle size, queries, the single-core CPU budget |
| `error-handling-rules` | Error boundaries, API errors, form errors, error UI |
| `testing-strategy` | Writing any test, deciding what layer (unit/integration/E2E) a change needs |
| `deployment-checklist` | Deploying to production, setting up a new environment, troubleshooting a broken deploy |
| `code-review-rules` | Reviewing a diff, self-reviewing before finishing a change, anti-patterns, refactoring, Definition of Done |
| `output-conventions` | File naming, import order, comments, commit messages |
| `git-workflow` | Any commit/push, pre-push audit, or git-safety decision |
| `ai-efficiency` | Exploring the repo or reading docs; drafting a prompt for another agent; minimizing context/token usage |
| `debugging` | A bug report, an unexpected test failure, or behavior that doesn't match expectations |
| `skill-maintenance` | Adding, editing, merging, or removing a skill; updating the AGENTS.md skill table |

## Current Status

See `docs/TASK.md` for the itemized list and **canonical test counts** (do not
hardcode counts in AGENTS.md or skills). Core infrastructure, rooms, playback
sync, chat, subtitles, presence/heartbeat, scheduled tasks, and security
hardening are complete with backend, frontend, E2E, and a11y test coverage;
room-ownership-transfer UX polish is done (Batch 2C, TAM-005). Pending:
production deployment steps and the eventual WebSocket migration.
