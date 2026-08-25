<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://via.placeholder.com/400x100/1e293b/ffffff?text=%D8%AA%D9%85%D8%A7%D8%B4%D8%A7%D8%B1%D9%88%D9%85">
    <img alt="تماشاروم" src="https://via.placeholder.com/400x100/ffffff/1e293b?text=%D8%AA%D9%85%D8%A7%D8%B4%D8%A7%D8%B1%D9%88%D9%85" width="400">
  </picture>
</p>

<p align="center" dir="rtl">
تماشاروم — با دوستانتان فیلم ببینید، انگار کنار هم هستید
</p>

---

**تماشاروم** is a synchronized watch-party platform for Persian speakers. Friends scattered across cities — or across the world — open the same video together and watch it in real-time sync: when one person pauses, everyone pauses; when one seeks, everyone follows. No counting down to hit play at the same time, no "wait, where are you now?" over the phone.

The idea is simple: you create a private room, share an invite link, and suddenly you're watching together again, with in-room chat, soft subtitles, and a shared sense of presence. The video plays from an external link — nothing is stored on our servers, just the state that keeps everyone in sync.

It started as a late-night thought: *why is it so hard to watch a movie with someone who isn't in your living room?* This is the answer, piece by piece.

> 🌐 [tamasharoom.ir](https://tamasharoom.ir) — coming soon

---

## Built With

| | |
|---|---|
| **Backend** | Laravel 13, PHP 8.4, MySQL / MariaDB |
| **Frontend** | React 19, Inertia.js 2, TypeScript (strict) |
| **Styling** | Tailwind CSS 4, RTL-first (Persian) |
| **Build** | Vite 5 |
| **Infrastructure** | Shared cPanel hosting — Apache, single-core, no Docker, no Redis, no WebSockets. Broadcasting: Pusher push transport (primary), Apinator backup (dormant), database queue + cron fallback. Polling remains as fallback when `BROADCAST_CONNECTION=null` (CI) or unconfigured. Future: Laravel Reverb self-hosted when scaling beyond 500 concurrent |
| **Local Dev** | Herd Community Edition (Native Windows) — PHP 8.4 + Nginx + MySQL + Vite HMR 5173 (wss, Herd SSL). No Docker, no Redis. Production stays on cPanel/Apache. |

---

## Local Development (Herd Community Edition — Native Windows)

> **Local only** — Herd CE is for native local development on Windows. Production remains on shared cPanel hosting (Apache, PHP 8.4, MySQL). Do not deploy Herd to production. No Docker, no Laragon.

**Prerequisites:** Herd **Community Edition** (https://herd.laravel.com — includes Nginx, PHP 8.4, MySQL, Node manager), Composer, Node 24.19.0 (via Herd's Node manager or `nvm-windows` → `nvm use 24.19.0`)

**Setup (once, ~5 min):**

1. **Install Herd CE** — download from https://herd.laravel.com, install with **PHP 8.4**, **Nginx**. After install, open Herd → Settings → PHP → `8.4` (active, `herd which-php` → `C:/Users/Khashayar/.config/herd/bin/php84/php.exe`).

2. **Add project:**
   ```bash
   # Project is already at C:\Users\Khashayar\Documents\TamashaRoom — Herd auto-parks parent folders.
   # Verify: Herd → Sites → tamasharoom.test → https://tamasharoom.test → C:\Users\Khashayar\Documents\TamashaRoom → Secured Yes, PHP 8.4
   # If not listed: Herd → Settings → Sites → Park → Add C:\Users\Khashayar\Documents\TamashaRoom
   # Or move to Herd sites: C:\Users\Khashayar\.config\herd\config\valet\Sites\tamasharoom
   ```

3. **SSL (automatic):** Herd → Sites → `tamasharoom.test` → Right-click → **Secure** (or `herd secure tamasharoom.test`). Herd auto-adds `127.0.0.1 tamasharoom.test` + `::1 tamasharoom.test` to hosts and generates certs at `C:\Users\Khashayar\.config\herd\config\valet\Certificates\tamasharoom.test.crt` (trusted via Herd's CA at `.../CA/LaravelValetCASelfSigned.crt` — no `mkcert`/`laragon` needed).

4. **Env & DB (Herd defaults):**
   ```bash
   cp .env.example .env
   # .env is already Herd-native: APP_URL=https://tamasharoom.test, DB_HOST=127.0.0.1, DB_PORT=3306, DB_DATABASE=tamasharoom, DB_USERNAME=root, DB_PASSWORD= (empty), no NO_PROXY
   composer install
   php artisan key:generate
   php artisan migrate --seed
   ```

5. **Frontend (Herd terminal):**
   ```bash
   # Herd terminal already has php, node, composer in PATH (herd which-php, herd which-node)
   npm install
   npm run dev   # Vite HMR on https://tamasharoom.test:5173 (wss, https: true, host tamasharoom.test)
   # App at https://tamasharoom.test (Herd Nginx → php-fpm 8.4), HMR at wss://tamasharoom.test:5173
   ```

6. **Reload:** Herd → **Restart** (or `herd restart`). Open `https://tamasharoom.test` — should be `<500ms` TTFB, works VPN ON/OFF (hosts `127.0.0.1` loopback, `NO_PROXY` not needed natively).

**Common commands (native, Herd terminal, no `sail exec`):**

| Task | Command |
|---|---|
| Start | Herd → **Start** (auto) or `herd start` |
| Stop | Herd → **Stop** or `herd stop` |
| Restart Nginx | `herd restart` |
| Secure | `herd secure tamasharoom.test` / `herd unsecure tamasharoom.test` |
| Artisan | `php artisan <cmd>` (e.g. `migrate`, `test`) or `herd php artisan <cmd>` |
| Tests | `php artisan test` + `npm run test` |
| Vite build | `npm run build` |
| MySQL shell | `herd db` or `mysql -u root -p` (Herd → Database) |
| Nginx site conf | `C:\Users\Khashayar\.config\herd\config\valet\Nginx\tamasharoom.test.conf` (auto-generated; edit only if rewrites needed) |
| Node version | Herd → Settings → Node → `24.19.0` or `nvm use 24.19.0` |

**Notes:**
- **No Docker/Sail/Laragon:** `compose.yaml` + `docker/` + `C:/laragon` removed — `laravel/sail` remains in `composer.json` as unused dev dep (remove with `composer remove laravel/sail` if desired).
- **No Redis:** `CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `SESSION_DRIVER=database` unchanged.
- `.env` for Herd: `DB_HOST=127.0.0.1`, `APP_URL=https://tamasharoom.test`, no `NO_PROXY` (not needed natively — `hosts` is `127.0.0.1` direct).
- `vite.config.js` uses `https: true` + `hmr wss://tamasharoom.test` — Herd's CA is trusted system-wide, Vite works without hardcoded `C:/laragon/...` paths; in CI (no Herd) Vite falls back via `https: true` self-signed (browser will warn, but CI uses `http://127.0.0.1:8000` fallback via `resolveBaseUrl()`).
- **VPN-safe:** `hosts` is `127.0.0.1` + `::1` loopback — works VPN ON/OFF; Herd's Nginx binds `0.0.0.0:80/443` + `[::]:80/443` by default.

---

## Proprietary Notice

TamashaRoom is **not open source**. The source code is made publicly viewable on GitHub as a portfolio and reference, but it is not licensed for reuse, forking, modification, or redistribution. All rights are reserved.

You may look, learn, and be inspired — but you may not copy, deploy, or distribute this code or any derivative of it without explicit written permission.
