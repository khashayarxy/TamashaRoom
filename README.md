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
| **Local Dev** | Laragon (Native Windows) — PHP 8.4 + Nginx + MySQL + Vite HMR 5173 (wss, Laragon SSL). No Docker, no Redis. Production stays on cPanel/Apache. |

---

## Local Development (Laragon — Native Windows)

> **Local only** — Laragon is for native local development on Windows. Production remains on shared cPanel hosting (Apache, PHP 8.4, MySQL). Do not deploy Laragon to production. No Docker.

**Prerequisites:** Laragon **Full** (https://laragon.org/download/ — includes Nginx, PHP 8.4, MySQL, Node via Laragon or `nvm`), Composer, Node 24.x

**Setup (once, ~5 min):**

1. **Install Laragon Full** — during install select **PHP 8.4**, **Nginx**, **MySQL**. After install, open Laragon → Menu → PHP → Version → `php-8.4` (active).

2. **Add project:**
   ```bash
   # Option A: Clone directly into Laragon www
   git clone https://github.com/khashayarxy/TamashaRoom.git C:\laragon\www\tamasharoom.test
   cd C:\laragon\www\tamasharoom.test

   # Option B: Keep existing path and park via Laragon
   # Laragon → Menu → www → Add → C:\Users\Khashayar\Documents\TamashaRoom → name tamasharoom.test
   ```

3. **Hosts & SSL (automatic):** Laragon → Menu → **www** → `tamasharoom.test` → **Enable SSL** (or Right-click → Nginx → SSL → Enable). Laragon auto-adds `127.0.0.1 tamasharoom.test` to `C:\Windows\System32\drivers\etc\hosts` and generates certs at `C:\laragon\etc\ssl\laragon.crt` + `laragon.key` (trusted via Laragon's CA, no `mkcert` needed).

4. **Env & DB:**
   ```bash
   cp .env.example .env
   # .env is already Laragon-native: APP_URL=https://tamasharoom.test, DB_HOST=127.0.0.1, DB_USERNAME=root, DB_PASSWORD=, no NO_PROXY
   composer install
   php artisan key:generate
   php artisan migrate --seed
   ```

5. **Frontend:**
   ```bash
   npm install
   npm run dev   # Vite HMR on https://tamasharoom.test:5173 (wss, uses C:/laragon/etc/ssl/laragon.crt)
   # App at https://tamasharoom.test (Nginx → php-fpm 8.4), HMR at wss://tamasharoom.test:5173
   ```

6. **Reload:** Laragon → **Reload** (or **Start All**). Open `https://tamasharoom.test` — should be `<500ms` TTFB.

**Common commands (native, no `sail exec`):**

| Task | Command |
|---|---|
| Start | Laragon → **Start All** |
| Stop | Laragon → **Stop** |
| Reload Nginx | Laragon → **Reload** |
| Artisan | `php artisan <cmd>` (e.g. `migrate`, `test`) |
| Tests | `php artisan test` + `npm run test` |
| Vite build | `npm run build` |
| MySQL shell | `mysql -u root -p` (Laragon → Database → Open) |
| Nginx site conf | `C:\laragon\etc\nginx\sites-enabled\tamasharoom.test.conf` (auto-generated; edit only if rewrites needed) |

**Notes:**
- **No Docker/Sail:** `compose.yaml` and `docker/` removed — `sail-8.4/app` + `nginx:alpine` no longer used. `laravel/sail` remains in `composer.json` as dev dep but is not used (remove with `composer remove laravel/sail` if desired).
- **No Redis:** `CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `SESSION_DRIVER=database` unchanged.
- `.env` for Laragon: `DB_HOST=127.0.0.1`, `APP_URL=https://tamasharoom.test`, no `NO_PROXY` (not needed natively — `hosts` is `127.0.0.1` direct, no container proxy).
- `vite.config.js` reads `C:/laragon/etc/ssl/laragon.crt` when present → `https` + `hmr wss://tamasharoom.test`; in CI (no cert) falls back to `http/ws`.
- **VPN-safe:** `hosts` is `127.0.0.1` loopback — works VPN ON/OFF; Laragon's Nginx binds `0.0.0.0:80/443` + `[::]:80/443` by default.

---

## Proprietary Notice

TamashaRoom is **not open source**. The source code is made publicly viewable on GitHub as a portfolio and reference, but it is not licensed for reuse, forking, modification, or redistribution. All rights are reserved.

You may look, learn, and be inspired — but you may not copy, deploy, or distribute this code or any derivative of it without explicit written permission.
