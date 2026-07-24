---
name: deployment-checklist
description: Step-by-step deployment procedure for TamashaRoom's shared cPanel hosting — pre-deploy checks, the deploy sequence, cron setup, and rollback. Use when deploying to production, setting up a new environment, or troubleshooting a broken production deploy.
---

# Deployment Checklist (Shared cPanel Hosting)

Full context: `docs/PROJECT.md` (Scripts, Environment Variables) and
`docs/SYSTEM.md` Chapter 18 (no Docker, no Redis, no persistent workers, no
root access — see `laravel-backend-rules`).

## Before Every Deploy

- [ ] CI is green on the commit being deployed (lint, type-check, PHPUnit,
      Vitest, build — see `.github/workflows/ci.yml`).
- [ ] `docs/TASK.md` reflects what's actually shipping in this deploy.
- [ ] No pending migration you haven't reviewed for data loss (a `DROP
      COLUMN` or renamed table on a live database needs a backup first, not
      just a green CI run).
- [ ] `.env` on the server has `APP_DEBUG=false` — verify this explicitly,
      don't assume it's still set correctly (see `security-rules`).

## The Deploy Sequence

Run in this exact order. Each step depends on the one before it.

```bash
# 1. Pull the deployed commit
git pull origin master

# 2. Install PHP dependencies (no dev deps, optimized autoloader)
composer install --no-dev --optimize-autoloader

# 3. Install and build frontend assets
#    Node 22 is a build-time tool only — it is not running on the server
#    afterward, per docs/PROJECT.md's tech stack table.
npm ci
npm run build

# 4. Run database migrations
php artisan migrate --force

# 5. Rebuild Laravel's optimization caches — mandatory, not optional.
#    Skipping this means every request re-parses config and re-resolves
#    every route from scratch (docs/SYSTEM.md 18.03, Rule 3).
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 6. Verify the storage symlink exists (subtitle uploads depend on it)
php artisan storage:link
```

## One-Time Environment Setup (new server only)

- [ ] `.env` configured per `docs/PROJECT.md`'s Environment Variables table
      — especially `CACHE_STORE=database`, `SESSION_DRIVER=database`,
      `QUEUE_CONNECTION=database`, `BROADCAST_CONNECTION=log`
      (there is no Redis; see `laravel-backend-rules`).
- [ ] The **one** cPanel cron entry is set, and only one:
  ```
  * * * * * php /home/tamasharoom/artisan schedule:run >> /dev/null 2>&1
  ```
  Everything else (queue draining, sitemap generation, session pruning,
  room pruning) is registered inside `routes/console.php` — do **not** add
  additional cron lines for individual tasks.
- [ ] PHP-FPM worker count is set sensibly for 2GB RAM — start from the
  host's recommended default, adjust only after measuring actual memory
  per worker (docs/SYSTEM.md 21.10).
- [ ] `storage/` and `bootstrap/cache/` are writable by the web server user.

## After Every Deploy

- [ ] Load the app in a browser — confirm it actually renders, not just
      that the deploy commands exited 0.
- [ ] Check `storage/logs/laravel.log` for anything unexpected in the first
      few minutes.
- [ ] Confirm the scheduler is still firing: `php artisan schedule:list`
      shows the expected jobs, and the cron entry above is unchanged.
- [ ] Spot-check one room end-to-end: create, join with a second session,
      confirm playback sync polling is working.

## Rollback

Shared hosting has no blue-green deploy and no instant traffic-shifting.
Rollback here means:

```bash
git checkout <previous-known-good-commit>
composer install --no-dev --optimize-autoloader
npm ci && npm run build
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

**If the deploy included a migration**, decide *before* rolling back the
code whether the migration is safe to leave in place (additive — new
column, new table) or must also be reversed with
`php artisan migrate:rollback`. Never assume a migration rollback is safe
without checking whether the previous code version expects the old schema.

## Common Failure Points on This Hosting Profile

- **Stale route/config cache**: if a route or env change doesn't seem to
  take effect, re-run step 5 above — a cached route/config file silently
  overrides the new `.env` or `routes/` changes.
- **Missing storage symlink** after a fresh deploy to a new document root —
  subtitle uploads will 404 until `php artisan storage:link` runs.
- **Queue backlog**: since there's no persistent worker, queued jobs only
  drain on the scheduled `queue:work --stop-when-empty` tick (see
  `laravel-backend-rules`). A burst of queued jobs right after deploy may
  take a minute or two to fully clear — this is expected, not a bug.
- **N+1 queries slipping through**: `Model::preventLazyLoading()` is
  disabled in production by design (docs/SYSTEM.md 18.03) — an N+1 that
  never threw locally can still exist in prod. Watch `laravel.log` and slow
  query patterns after any change touching Eloquent relationships.
