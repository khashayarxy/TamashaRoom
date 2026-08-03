# TamashaRoom — Deployment Checklist

> Run these steps in order on your production server.

**Web root:** the cPanel document root must point at `public/`. Built frontend
assets live in `public/build/` (output of `npm run build`); upload the whole project
so `public/build` sits inside the web root.

**Node.js is a build-time tool only.** `npm ci` and `npm run build` may be run
off-server (any machine with Node 22+) before uploading. cPanel needs only the
resulting `public/build/` assets — Node.js does **not** need to be installed on
production hosting.

---

## 1. Environment Configuration

```bash
cp .env.example .env
# Edit .env — set these values:
```

| Variable | Required Value | Notes |
|---|---|---|
| `APP_ENV` | `production` | Disables debug mode |
| `APP_DEBUG` | `false` | Hides stack traces |
| `APP_KEY` | (generate) | `php artisan key:generate --force` — **only** on a new install; never regenerate an existing production key |
| `SESSION_SECURE_COOKIE` | `true` | HTTPS-only session cookies (required — see TAM-008) |
| `SESSION_DRIVER` | `database` | DB-backed sessions — required on a single server |
| `QUEUE_CONNECTION` | `database` | Queue drained by the scheduler; no persistent worker |
| `CACHE_STORE` | `database` | DB cache store — required (Laravel 13 uses `CACHE_STORE`, not `CACHE_DRIVER`) |
| `DB_*` | Your production DB credentials | — |
| `SENTRY_DSN` | (optional) | For error monitoring |

---

## 2. Database

```bash
php artisan migrate --force
```

This runs all 14 migrations: 3 framework base files (users + password_reset_tokens + sessions, cache + cache_locks, jobs + job_batches + failed_jobs) plus 11 application migrations (rooms, room_members, chat_messages, playback state version, subtitle_tracks, presence fields, is_locked, playback_mode, last_activity_at index, active_subtitle_track_id on rooms, personal_access_tokens).

**Expected output:** `Migration table created successfully.` then all migrations marked as `[OK]`.

---

## 3. Storage Symlink

```bash
php artisan storage:link
```

Creates `public/storage → storage/app/public`. Required for subtitle file uploads. If the symlink already exists, the command is idempotent ("The [public/storage] link already exists").

**Verify:** `ls -la public/storage` shows a symlink to `../storage/app/public`.

---

## 4. Background Work (no persistent worker)

TamashaRoom has **no persistent queue worker and no daemon process** — shared hosting
cannot keep one running reliably, and the host disallows it. Subtitle uploads are
handled synchronously inside the request; nothing is queued for them.

`routes/console.php` schedules `queue:work --stop-when-empty --max-time=30` every minute
(without overlapping), so any queued job is drained in small batches by the same
`schedule:run` cron entry that runs the scheduled tasks. **No separate worker,
supervisor, or wrapper script is needed.**

| Task | Frequency | How it runs |
|---|---|---|
| `queue:work --stop-when-empty` | Every minute | Drained by the scheduled `schedule:run` cron |
| `presence:timeout` | Every minute | Same `schedule:run` cron |
| `rooms:prune-inactive` | Daily | Same `schedule:run` cron |

**Verify:** `php artisan schedule:list` confirms all three are registered.

## 5. Scheduled Tasks (cron)

Add ONE cron entry for `schedule:run`:

```
* * * * * php /path/to/tamasharoom/artisan schedule:run >> /dev/null 2>&1
```

| Task | Frequency | What it does |
|---|---|---|
| `presence:timeout` | Every minute | Marks stale members (90s+ no heartbeat) as offline |
| `rooms:prune-inactive --days=7` | Daily | Deletes rooms inactive 7+ days + their files/messages/members |
| `queue:work --stop-when-empty --max-time=30` | Every minute | Drains any queued jobs in batches |

**Verify:** Run `php artisan schedule:list` to confirm **all three** tasks above are registered.

---

## 6. Security Hardening

```bash
# Generate APP_KEY ONLY on a new installation with no existing production APP_KEY:
php artisan key:generate --force
# Never regenerate an existing production APP_KEY during normal deployment or
# rollback — doing so invalidates all active sessions, cookies, and signed data.

# Cache config & routes for performance
php artisan config:cache
php artisan route:cache

# View caching (if using Blade views — not strictly required for Inertia)
php artisan view:cache
```

**Note:** After `php artisan config:cache`, changes to `.env` are ignored until you re-run `config:cache`. Use `config:clear` during development.

---

## 7. Verify Deployment

| Check | How |
|---|---|
| App loads | `curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com` → `200` |
| Inertia renders | Page source contains `<div id="app" data-page="...">` |
| Login works | Visit `/login` — form renders in Persian |
| Registration works | Create a test account |
| Storage accessible | `curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/storage/` → `200` or redirect |
| Queue drained | `php artisan queue:failed` → no failed jobs (jobs table stays empty) |
| Cron is running | Create a room, wait 1+ minute, verify `presence:timeout` worked |
| Rate limiting | Login with wrong password 6+ times → `429 Too Many Requests` |
| Security headers | `curl -s -I https://yourdomain.com | grep -i 'content-security-policy'` → CSP present |

---

## 8. Rollback Plan

If a deployment fails:

- **Database:** restore the pre-deployment backup taken before `migrate --force`
  (see below), **or** apply a specifically reviewed corrective migration. Do not run
  `php artisan migrate:rollback` against production — an unrestricted rollback can
  drop data added after the last `migrate` and is not safe on shared hosting.
- **Code/assets:** deploy the previous build's `public/build/` assets and revert any
  code changes.

```bash
# Clear caches after rollback
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

**Before every deployment**, take a database backup (mysqldump via cPanel) so a
rollback has a restore point.

---

## 9. Post-Deployment Monitoring

- **Sentry** (if configured): Monitor error rate in the first 24h
- **Laravel log**: `tail -f storage/logs/laravel.log`
- **Queue failures**: `php artisan queue:failed` — retry with `php artisan queue:retry all`
- **Disk usage**: `du -sh storage/app/public/subtitles/` — subtitle files accumulate

---

## 10. Summary of Commands (in order)

```bash
# 1. Set up
composer install --no-dev --optimize-autoloader
# php artisan key:generate --force   # ONLY on a new install (no existing production APP_KEY)

# 2. Database
php artisan migrate --force

# 3. Storage
php artisan storage:link

# 4. Add cron entry
#    * * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1
#    (runs scheduled tasks + drains the queue in batches — no separate worker needed)

# 5. Cache
php artisan config:cache
php artisan route:cache

# 6. Build frontend (may be run off-server; upload only public/build/ to cPanel)
npm ci
npm run build
```
