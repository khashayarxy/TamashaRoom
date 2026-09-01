# TamashaRoom — Agent Instructions

This file is always loaded into context. Keep it short. Deep-dive rules live in
`.skills/` (git-tracked source of truth, aliased locally to `.opencode/skills/` and `.agents/skills/`) and are loaded on demand — see "Available Skills" below.
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
Instead: state changes are written as a Laravel broadcastable Event and pushed
via the Pusher push transport (primary), with Apinator as a dormant backup
driver and a database queue + cron fallback. Polling remains as fallback when
`BROADCAST_CONNECTION=null` (CI) or unconfigured, on a tiered cadence — 3 seconds
while playing, 10 seconds while paused/idle (adjustable post-MVP). This is
deliberate and transport-agnostic — moving to real-time later means installing
Laravel Reverb on a VPS when scaling beyond 500 concurrent and flipping
`BROADCAST_CONNECTION`, not rewriting the feature. **Never build new
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
- Persian (RTL) and dark mode are the default, not an overlay. Prefer Tailwind's
  logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`).
  Physical positioning utilities are allowed only when the position must remain
  invariant (for example, centered or edge-to-edge overlays); see
  `rtl-and-design-system`.
- Business logic lives in Laravel Actions/Services and frontend hooks — never
  directly in controllers or components.
- Every async operation has explicit loading, error, success, and empty states.
- No commented-out code; no TODO without a ticket reference. No `console.log`
  is enforced by ESLint (`no-console`) — see `output-conventions`.
- Git safety: never commit or push unless explicitly asked; never force-push,
  never `reset --hard`/`clean -fd`, never amend a pushed commit. See the
  `git-workflow` skill before any git operation.

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
npm run test:e2e             # E2E (Playwright) — CI ONLY, never routine local runs (1.5h+); see git-workflow skill
npm run test:a11y            # Accessibility audit (@axe-core/playwright) — CI ONLY; use :contrast locally
npm run test:a11y:contrast   # Fast contrast a11y audit (Playwright — run when editing UI)
php artisan test              # Backend feature/unit tests (PHPUnit)
# Standing rule: local verification is fast-only; E2E + full a11y are verified
# by GitHub Actions CI after push (see .skills/git-workflow/SKILL.md).

# Local environment health check (run after every task)
.\scripts\verify-local-env.ps1   # Hosts, VPN proxy bypass, Herd, SSL, connectivity

# Database
php artisan migrate
php artisan db:seed

# Production build (see docs/PROJECT.md for the full deploy sequence)
npm run build
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

## MCP Setup (OpenCode)

`opencode.json` (`mcp` key) is the source of truth — restart OpenCode after editing it.

| MCP | Package | Status | Purpose |
|---|---|---|---|
| `laravel-boost` | `php artisan boost:mcp` | ✅ active | DB schema/query, app-info, search-docs |
| `context7` | `@upstash/context7-mcp` | ✅ active | Laravel 13 / React 19 / Vite 5 docs (no hallucination) |
| `playwright` | `@playwright/mcp@latest` | ✅ active | Browse `https://tamasharoom.test`, screenshots, clicks |
| `filesystem` | `@modelcontextprotocol/server-filesystem` | ✅ active | Direct R/W in `C:/Users/Khashayar/Documents/TamashaRoom` |
| `sqlite` | `@mokei/mcp-sqlite` | ⚠️ disabled | Requires native `sqlite3` bindings (fails on Herd/Windows) — use `laravel-boost` `database-query`/`database-schema` instead |
| `fetch` | `@modelcontextprotocol/server-fetch` | ⚠️ disabled | 404 on npm — use built-in `webfetch`/`websearch` tools |

- `context7` + `playwright` are **mandatory** for AI-assisted tasks (highest ROI).
- All use `npx -y` (no interactive prompt). Paths use forward slashes.
- Reset recovery: copy snippet from `opencode.json` comments or run the `npx -y <package>` commands above.
- `sqlite`/`fetch` disabled intentionally — covered by `laravel-boost` and `webfetch`; `Brave Search` needs `BRAVE_API_KEY` — ask before enabling.
- Verify after change: `npx -y @upstash/context7-mcp --help`, `npx -y @playwright/mcp@latest --help`, `.\scripts\verify-local-env.ps1`

## Auto-Build Workflow

After EVERY commit that includes frontend changes (JS/CSS/Vite config), the
post-commit hook automatically runs `npm run build`.

- Pure backend commits skip the build (fast feedback)
- Build failures block task completion (same as health check)
- Manual trigger: `.\scripts\auto-build.ps1`
- Never manually run `npm run build` for local dev — the hook handles it.
- Frontend detection: `resources/js/`, `resources/css/`, `vite.config.js`,
  `package.json`

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

Skill definitions are tracked in git under `.skills/`. Local agent tooling discovers them via `.opencode/skills` or `.agents/skills`. On a fresh clone, run:
- **Windows (PowerShell):** `New-Item -ItemType Junction -Path .opencode/skills -Target .skills` ; `New-Item -ItemType Junction -Path .agents/skills -Target .skills`
- **Linux / macOS:** `ln -s .skills .opencode/skills && ln -s .skills .agents/skills`

| Skill | Load it when working on... |
|---|---|
| `mvp-scope-decisions` | A new feature request, a new dependency, or anything that might expand scope — check this *before* writing code |
| `laravel-backend-rules` | Controllers, models, Events, routes, caching, queues, the polling/broadcast pattern, Actions/Services |
| `react-rules` | Components, hooks, state, component architecture/categories, where state lives, React Compiler-aware performance |
| `typescript-tailwind-rules` | Types, Zod schemas, Tailwind classes, `cn()`, dark mode |
| `rtl-and-design-system` | Layout, typography, color, RTL/Persian-specific UI, motion |
| `rtl-i18n-policy` | Any new UI feature/component — decide whether it should be RTL, Persian-labeled, both, or stay LTR/neutral before implementing |
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
| `blocker-resilience-rules` | Handling ad-blockers, tracking protection, or client-blocked scripts, CDNs, embeds, or WebSockets |
| `skill-maintenance` | Adding, editing, merging, or removing a skill; updating the AGENTS.md skill table |

**Intentionally excluded from the table:** the five Boost-managed skills —
`echo-development`, `inertia-react-development`, `infer-conventions`,
`laravel-best-practices`, `tailwindcss-development` — are third-party guidance
synced by `php artisan boost:update` (see `boost.json` `skills[]`) and skipped
by `npm run check:docs`. They are regenerated, not hand-edited, and where they
conflict with a project skill above, the project skill wins.

## Current Status

See `docs/TASK.md` for the itemized list and **canonical test counts** (do not
hardcode counts in AGENTS.md or skills). Core infrastructure, rooms, playback
sync, chat, subtitles, presence/heartbeat, scheduled tasks, security
hardening, room-ownership-transfer UX polish (Batch 2C, TAM-005), and the
2026-08-04 audit-fix pass (Phases 0–7) are complete with backend, frontend,
E2E, and a11y coverage. Pending: production deployment steps and the eventual
WebSocket migration.

===

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application running on PHP 8.4. You are an expert with the Laravel ecosystem. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version:
- PHP packages: run `composer show --direct` to list direct dependencies with versions, or `composer show <vendor/package>` for a single package.
- JS packages: check `package.json` for the installed versions.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Always use `search-docs` before making code changes. Do not skip this step. It returns version-specific docs based on installed packages automatically.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Project Rules

- This project contains committed, area-grouped rules in `.ai/rules` when that directory exists (settled decisions, non-obvious traps, standing constraints). Framework and package guidelines that only apply to specific paths (testing, frontend, components) also live there, under `.ai/rules/boost` — this is not just recorded decisions, it is load-bearing guidance you have not seen inline. Before you enter plan mode or create/edit any file, you MUST first: open @.ai/rules/index.md (it maps file globs to rule files), read every rule file whose globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules` to catch what a path match alone misses. Do not write code until you have read and are following every matching rule. If `.ai/rules` does not exist, continue without it.
- Record durable rules with `record-rule` so the next agent or teammate inherits them instead of working them out again. Pass a `glob` (e.g. `app/Http/Controllers/**`), a short `title`, and a few-line `note`. Always use `record-rule`, never your native memory or notes tool — native memory is personal and session-scoped; only `.ai/rules` is shared with the team and persists in the repo.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Follow existing application Enum naming conventions.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== herd rules ===

# Laravel Herd

- The application is served by Laravel Herd at `https?://[kebab-case-project-dir].test`. Use the `get-absolute-url` tool to generate valid URLs. Never run commands to serve the site. It is always available.
- Use the `herd` CLI to manage services, PHP versions, and sites (e.g. `herd sites`, `herd services:start <service>`, `herd php:list`). Run `herd list` to discover all available commands.

=== tests rules ===

# Test Enforcement

- Every change must be programmatically tested. Write a new test or update an existing test, then run the affected tests to make sure they pass.
- Run the minimum number of tests needed to ensure code quality and speed. Use `php artisan test --compact` with a specific filename or filter.

=== inertia-laravel/core rules ===

# Inertia

- Inertia creates fully client-side rendered SPAs without modern SPA complexity, leveraging existing server-side patterns.
- Components live in `resources/js/Pages` (unless specified in `vite.config.js`). Use `Inertia::render()` for server-side routing instead of Blade views.
- ALWAYS use `search-docs` tool for version-specific Inertia documentation and updated code examples.
- IMPORTANT: Activate `inertia-react-development` when working with Inertia client-side patterns.

# Inertia v3

- Use all Inertia features from v1, v2, and v3. Check the documentation before making changes to ensure the correct approach.
- New v3 features: standalone HTTP requests (`useHttp` hook), optimistic updates with automatic rollback, layout props (`useLayoutProps` hook), instant visits, simplified SSR via `@inertiajs/vite` plugin, custom exception handling for error pages.
- Carried over from v2: deferred props, infinite scroll, merging props, polling, prefetching, once props, flash data.
- When using deferred props, add an empty state with a pulsing or animated skeleton.
- Axios has been removed. Use the built-in XHR client with interceptors, or install Axios separately if needed.
- `Inertia::lazy()` / `LazyProp` has been removed. Use `Inertia::optional()` instead.
- Prop types (`Inertia::optional()`, `Inertia::defer()`, `Inertia::merge()`) work inside nested arrays with dot-notation paths.
- SSR works automatically in Vite dev mode with `@inertiajs/vite` - no separate Node.js server needed during development.
- Event renames: `invalid` is now `httpException`, `exception` is now `networkError`.
- `router.cancel()` replaced by `router.cancelAll()`.
- The `future` configuration namespace has been removed - all v2 future options are now always enabled.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `./vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `./vendor/bin/pint --test --format agent`, simply run `./vendor/bin/pint --format agent` to fix any formatting issues.

=== phpunit/core rules ===

# PHPUnit

- This application uses PHPUnit for testing. All tests must be written as PHPUnit classes. Use `php artisan make:test --phpunit {name}` to create a new test.
- If you see a test using "Pest", convert it to PHPUnit.
- Every time a test has been updated, run that singular test.
- When the tests relating to your feature are passing, ask the user if they would like to also run the entire test suite to make sure everything is still passing.
- Tests should cover all happy paths, failure paths, and edge cases.
- You must not remove any tests or test files from the tests directory without approval. These are not temporary or helper files; these are core to the application.

## Running Tests

- Run the minimal number of tests, using an appropriate filter, before finalizing.
- To run all tests: `php artisan test --compact`.
- To run all tests in a file: `php artisan test --compact tests/Feature/ExampleTest.php`.
- To filter on a particular test name: `php artisan test --compact --filter=testName` (recommended after making a change to a related file).

=== inertia-react/core rules ===

# Inertia + React

- IMPORTANT: Activate `inertia-react-development` when working with Inertia React client-side patterns.

</laravel-boost-guidelines>
