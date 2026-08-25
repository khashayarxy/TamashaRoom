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
| **Local Dev** | Laravel Sail (Docker) — PHP 8.4 + MySQL 8.4 + Nginx (80/443, mkcert SSL) + Vite HMR 5173 (wss). No Redis. Production stays on cPanel/Apache. |

---

## Local Development (Docker — Laravel Sail)

> **Local only** — Docker/Sail is for isolated local development. Production remains on shared cPanel hosting (Apache, PHP 8.4, MySQL). Do not deploy Docker to production. SSL is local-only via mkcert.

**Prerequisites:** Docker Desktop + WSL 2, PHP 8.4 + Composer (for bootstrap only), Node 24.x, `mkcert` ( `winget install FiloSottile.mkcert` )

**Hosts file (required once):** Ensure `C:\Windows\System32\drivers\etc\hosts` contains:

```
127.0.0.1 tamasharoom.test
```

This is loopback-only → VPN-safe (works with VPN ON or OFF — no external adapter).

```bash
# 1. Clone & env
cp .env.example .env   # defaults to https://tamasharoom.test + mysql

# 2. SSL (one-time, ~10s) — mkcert creates ./docker/ssl/ (gitignored)
mkcert -install
mkdir -p docker/ssl
mkcert -cert-file docker/ssl/tamasharoom.test.pem -key-file docker/ssl/tamasharoom.test-key.pem tamasharoom.test "*.tamasharoom.test" localhost 127.0.0.1 ::1
# Certs: docker/ssl/tamasharoom.test.pem + -key.pem — never commit (see .gitignore: /docker/ssl/)

# 3. Start containers (nginx:80/443 → laravel.test:80, mysql:3306, vite:5173)
./vendor/bin/sail up -d          # Windows: docker compose up -d (sail wrapper requires WSL2 bash)
# First run builds sail-8.4/app — takes ~3-5 min. Nginx:alpine pulls in seconds.

# 4. Install deps inside container (important on Windows/WSL for permissions)
docker compose exec laravel.test composer install
docker compose exec laravel.test npm install   # uses sail-node_modules volume

# 5. DB
docker compose exec laravel.test php artisan key:generate
docker compose exec laravel.test php artisan migrate --seed

# 6. Dev servers
docker compose exec laravel.test npm run dev   # Vite HMR on https://tamasharoom.test:5173 (wss, VITE_HOST=0.0.0.0, certs from ./docker/ssl)
# App at https://tamasharoom.test (443, 80→301), Vite HMR at https://tamasharoom.test:5173
```

**Common commands:**

| Task | Command |
|---|---|
| Start | `docker compose up -d` or `wsl bash -c "./vendor/bin/sail up -d"` |
| Stop | `docker compose down` or `sail stop` |
| Logs (app) | `docker compose logs -f laravel.test` |
| Logs (nginx) | `docker compose logs -f nginx` |
| Artisan | `docker compose exec laravel.test php artisan <cmd>` (e.g. `migrate`, `test`) |
| Tests | `docker compose exec laravel.test php artisan test` + `npm run test` (host) |
| Vite build | `docker compose exec laravel.test npm run build` |
| MySQL shell | `docker compose exec mysql mysql -u sail -ppassword tamasharoom` |
| Rebuild SSL | `mkcert -cert-file docker/ssl/tamasharoom.test.pem -key-file docker/ssl/tamasharoom.test-key.pem tamasharoom.test "*.tamasharoom.test" localhost 127.0.0.1 ::1 && docker compose restart nginx` |

**Notes:**
- `compose.yaml` uses `sail-8.4/app` (PHP 8.4 to match prod) + `nginx:alpine` sidecar (`0.0.0.0:80→80`, `0.0.0.0:443→443`) + `mysql:8.4` — **no Redis** (`CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `SESSION_DRIVER=database` stay as-is).
- `sail-node_modules` volume prevents Windows/WSL permission issues; host `node_modules` is not bind-mounted.
- `.env` for Sail: `DB_HOST=mysql`, `APP_URL=https://tamasharoom.test`, `VITE_APP_URL=https://tamasharoom.test`, `VITE_HOST=0.0.0.0`, `APP_PORT=80`, `VITE_PORT=5173`. `.env.example` reflects these defaults.
- `vite.config.js` auto-detects `docker/ssl/*.pem` — when present serves HMR over `wss://tamasharoom.test:5173`; in CI (no certs) falls back to `ws://localhost:5173`.
- VPN-safe: `compose.yaml` binds `0.0.0.0:80/443` + `0.0.0.0:5173` (explicit) and nginx listens `80` + `[::]:80` / `443 ssl` + `[::]:443 ssl` + `http2 on` — so VPN virtual adapters (e.g., `198.18.x.x`, `10.x.x.x`) and `::1` both work; `host.docker.internal:host-gateway` for Docker DNS.

### VPN Troubleshooting

Local HTTPS (`https://tamasharoom.test`) is loopback-only and works with VPN **ON or OFF** — no external ports.

**Why VPN breaks it without `NO_PROXY`:** VPN tools (v2rayN `10809`, Clash `7890`) set a system `HTTP_PROXY=http://127.0.0.1:10809`. Browsers then try to proxy `tamasharoom.test` through that port instead of direct loopback → `ERR_CONNECTION_CLOSED`.

**Fix is bypass, NOT extra ports** (never bind Nginx to `10809`/`7890` — those ports are already used by the VPN client and would fail with `port already allocated`):

1. `compose.yaml` and `.env` already set:
   ```env
   NO_PROXY=localhost,127.0.0.1,tamasharoom.test,*.test,::1
   no_proxy=localhost,127.0.0.1,tamasharoom.test,*.test,::1
   ```
   This tells Docker, `curl`, and Node to go direct for those hosts.
2. Playwright E2E already launches with `--proxy-server=direct://` (`tests/e2e/playwright.config.ts`) for the same reason — `docs/TASK.md:148`.
3. Verify bypass:
   ```bash
   curl --ssl-no-revoke -s -o /dev/null -w "%{http_code}\n" https://tamasharoom.test                              # 200
   HTTPS_PROXY=http://127.0.0.1:10809 curl --noproxy "*" --ssl-no-revoke -s -o /dev/null -w "%{http_code}\n" https://tamasharoom.test  # 200
   ```
   `vite.config.js` HMR already uses `wss://tamasharoom.test:5173` (cert-aware) — no proxy detection.

**Do NOT** add `10809`/`7890` to `compose.yaml:ports` or `docker/nginx/conf.d/default.conf` `listen` — keep only `0.0.0.0:80:80, 0.0.0.0:443:443, 0.0.0.0:5173:5173`.

### Network / Firewall (explicit binding for VPN adapters)

`compose.yaml` now uses explicit `0.0.0.0:` bindings and `docker/nginx/conf.d/default.conf` listens `80` + `[::]:80` / `443 ssl` + `[::]:443 ssl` (`http2 on`) — verified `nginx -t` ok and `docker ps` shows `0.0.0.0:80->80`, `0.0.0.0:443->443`. This covers VPN virtual adapters (Clash `198.18.x.x`, etc.) and `::1` without binding to specific VPN IPs.

`sail` network is `driver: bridge` (default) — allows external ingress from host and VPN adapters; no `iptables` block.

**Windows Firewall (if VPN still blocks):** Run once in **Admin PowerShell**:

```powershell
New-NetFirewallRule -DisplayName "Sail Local Dev" -Direction Inbound -Protocol TCP -LocalPort 80,443,5173 -Action Allow -Profile Any
```

Verify:

```bash
ping -4 -n 1 tamasharoom.test      # 127.0.0.1 <1ms
curl --ssl-no-revoke https://tamasharoom.test          # 200
HTTPS_PROXY=http://127.0.0.1:10809 curl --noproxy "*" --ssl-no-revoke https://tamasharoom.test # 200
```

---

## Proprietary Notice

TamashaRoom is **not open source**. The source code is made publicly viewable on GitHub as a portfolio and reference, but it is not licensed for reuse, forking, modification, or redistribution. All rights are reserved.

You may look, learn, and be inspired — but you may not copy, deploy, or distribute this code or any derivative of it without explicit written permission.
