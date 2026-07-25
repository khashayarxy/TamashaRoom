# TamashaRoom — Deployment Checklist

> Run these steps in order on your production server.

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
| `APP_KEY` | (generate) | `php artisan key:generate` |
| `SESSION_SECURE_COOKIE` | `true` | HTTPS-only session cookies |
| `SESSION_DRIVER` | `file` or `database` | File is fine for single-server |
| `QUEUE_CONNECTION` | `database` | Required for subtitle uploads |
| `CACHE_DRIVER` | `file` | Single-server default |
| `DB_*` | Your production DB credentials | — |
| `SENTRY_DSN` | (optional) | For error monitoring |

---

## 2. Database

```bash
php artisan migrate --force
```

This runs all 13 migrations (users, rooms, room_member, chat_messages, subtitle_tracks, password_reset_tokens, personal_access_tokens, sessions, cache, jobs + any audit fix migrations).

**Expected output:** `Migration table created successfully.` then all migrations marked as `[OK]`.

---

## 3. Storage Symlink

```bash
php artisan storage:link
```

Creates `public/storage → storage/app/public`. Required for subtitle file uploads. If the symlink already exists, the command is idempotent ("The [public/storage] link already exists").

**Verify:** `ls -la public/storage` shows a symlink to `../storage/app/public`.

---

## 4. Queue Worker

The app uses `QUEUE_CONNECTION=database` for subtitle uploads and other async work.

### On cPanel (shared hosting):

Create a **python wrapper** to keep the worker alive (Node.js may not be available, but Python usually is):

Save this as `worker.py` outside the web root:

```python
import subprocess, sys, time, os

os.chdir("/path/to/tamasharoom")
while True:
    proc = subprocess.run(
        ["php", "artisan", "queue:work", "--queue=default", "--tries=3", "--timeout=60"],
        capture_output=True, text=True
    )
    print(proc.stdout, flush=True)
    print(proc.stderr, flush=True)
    if proc.returncode != 0:
        print(f"Worker crashed (code {proc.returncode}), restarting in 5s...", flush=True)
        time.sleep(5)
```

Run via a cPanel **cron job** (every minute) that checks if the worker is running:

```
* * * * * pgrep -f "artisan queue:work" || python3 /path/to/worker.py &
```

### On a VPS (systemd):

Create `/etc/systemd/system/tamasharoom-queue.service`:

```ini
[Unit]
Description=TamashaRoom Queue Worker
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/tamasharoom
ExecStart=/usr/bin/php artisan queue:work --queue=default --tries=3 --timeout=60
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable tamasharoom-queue
sudo systemctl start tamasharoom-queue
```

---

## 5. Scheduled Tasks (cron)

Add ONE cron entry for `schedule:run`:

```
* * * * * php /path/to/tamasharoom/artisan schedule:run >> /dev/null 2>&1
```

| Task | Frequency | What it does |
|---|---|---|
| `presence:timeout` | Every minute | Marks stale members (90s+ no heartbeat) as offline |
| `rooms:prune-inactive` | Daily | Deletes rooms inactive 7+ days + their files/messages/members |

**Verify:** Run `php artisan schedule:list` to confirm both tasks are registered.

---

## 6. Security Hardening

```bash
# Generate production APP_KEY if not already set
php artisan key:generate --force

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
| Queue is running | `php artisan queue:status` → `"Queue worker is running"` |
| Cron is running | Create a room, wait 1+ minute, verify `presence:timeout` worked |
| Rate limiting | Login with wrong password 6+ times → `429 Too Many Requests` |
| Security headers | `curl -s -I https://yourdomain.com | grep -i 'content-security-policy'` → CSP present |

---

## 8. Rollback Plan

If a deployment fails:

```bash
# Roll back database
php artisan migrate:rollback

# Clear caches
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

For a full rollback, deploy the previous build's `public/build/` assets and revert any code changes.

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
php artisan key:generate --force

# 2. Database
php artisan migrate --force

# 3. Storage
php artisan storage:link

# 4. Start queue worker (on VPS with systemd)
sudo systemctl enable tamasharoom-queue && sudo systemctl start tamasharoom-queue

# 5. Add cron entry
#    * * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1

# 6. Cache
php artisan config:cache
php artisan route:cache

# 7. Build frontend
npm ci --production
npm run build
```
