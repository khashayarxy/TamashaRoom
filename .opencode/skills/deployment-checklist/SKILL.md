---
name: deployment-checklist
description: Deployment procedure for TamashaRoom's shared cPanel hosting — the deploy sequence, cron setup, rollback, and common failure points. Use when deploying to production, setting up a new environment, or troubleshooting a broken production deploy. The step-by-step authority is docs/deployment-checklist.md; this skill is the operational summary.
---

# Deployment Checklist (Shared cPanel Hosting)

**Source of truth: `docs/deployment-checklist.md`** — read it for the full
step-by-step procedure before any deploy. Full project context:
`docs/PROJECT.md` (Scripts, Environment Variables) and `docs/SYSTEM.md`
Chapter 18. This skill is the condensed operational summary.

## Before Every Deploy

- [ ] CI is green on the commit being deployed (lint, type-check, PHPUnit,
      Pint, Vitest, Playwright a11y + E2E, build, Prettier — see
      `.github/workflows/ci.yml`).
- [ ] `docs/TASK.md` reflects what's actually shipping.
- [ ] No pending migration you haven't reviewed for data loss (a `DROP
      COLUMN` or renamed table needs a backup first).
- [ ] `.env` on the server has `APP_DEBUG=false` — verify explicitly, don't assume.

## The Deploy Sequence (exact order)

```bash
# 1. Pull the deployed commit
git pull origin master

# 2. Install PHP dependencies (no dev deps, optimized autoloader)
composer install --no-dev --optimize-autoloader

# 3. Install and build frontend assets (Node 22 is build-time only; run
#    off-server and upload the resulting public/build/ — Node is not needed
#    on cPanel)
npm ci
npm run build

# 4. Run database migrations
php artisan migrate --force

# 5. Rebuild Laravel's optimization caches — mandatory, not optional
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 6. Verify the private subtitle storage path is writable
#    (subtitle files use the local/private disk; no public symlink is required)
```

## One-Time Environment Setup (new server only)

- `.env` per `docs/PROJECT.md` — especially `CACHE_STORE=database`,
  `SESSION_DRIVER=database`, `QUEUE_CONNECTION=database`,
  `BROADCAST_CONNECTION=null` (no Redis).
- **One** cPanel cron entry, and only one:
  `* * * * * php /home/tamasharoom/artisan schedule:run >> /dev/null 2>&1`.
  Everything else (queue draining, room pruning, presence timeout) is
  registered inside `routes/console.php` — do **not** add individual cron lines.
- PHP-FPM workers sized for 2GB RAM; `storage/` and `bootstrap/cache/`
  writable by the web server user.

## After Every Deploy

- [ ] Load the app in a browser — confirm it renders, not just exit 0.
- [ ] Check `storage/logs/laravel.log` in the first few minutes.
- [ ] `php artisan schedule:list` shows the expected jobs; cron entry unchanged.
- [ ] Spot-check one room end-to-end: create, join with a second session,
      playback sync polling works.

## Rollback (safe, shared-hosting)

- **Database:** restore the pre-deployment backup taken before
  `migrate --force` (mysqldump via cPanel), **or** apply a specifically
  reviewed corrective migration. **Never** run unrestricted
  `php artisan migrate:rollback` against production.
- **Code/assets:** `git checkout <previous-known-good-commit>` +
  `composer install --no-dev --optimize-autoloader` + rebuild `public/build/`
  + re-run `config:cache`/`route:cache`/`view:cache`.

## Common Failure Points on This Hosting Profile

- **Stale route/config cache**: a cached config silently overrides new
  `.env`/`routes/` changes — re-run step 5.
- **Private subtitle storage not writable** after a fresh deploy — verify the
  account can write under `storage/app/private/` and that the authenticated
  subtitle endpoints can read the stored file. `storage:link` is not required.
- **Queue backlog**: queued jobs only drain on the scheduled
  `queue:work --stop-when-empty` tick — a burst may take a minute or two to
  clear; expected, not a bug.
- **N+1 queries**: `Model::preventLazyLoading()` is disabled in production by
  design — watch `laravel.log` for slow query patterns after any Eloquent change.
