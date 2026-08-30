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
| **Local Dev** | Herd Community Edition (Native Windows) — PHP 8.4 + Nginx + SQLite + Vite HMR 5173 (wss, Herd SSL). No Docker, no Redis. MySQL services require Herd Pro; local dev uses SQLite. Production stays on cPanel/Apache. |

---

## Local Development (Herd Community Edition — Native Windows)

> **Local only** — Herd CE is for native local development on Windows. Production remains on shared cPanel hosting (Apache, PHP 8.4, MySQL). Do not deploy Herd to production. No Docker, no Laragon.

**Prerequisites:** Herd **Community Edition** (https://herd.laravel.com — includes Nginx, PHP 8.4, Node manager), Composer, Node 24.19.0 (via Herd's Node manager or `nvm-windows` → `nvm use 24.19.0`)

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
   # .env defaults to SQLite (DB_CONNECTION=sqlite) — no MySQL required.
   # Session, cache, and queue use file-based drivers for local resilience.
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
| MySQL shell | `herd db` (requires Herd Pro) or use SQLite: `sqlite3 database/database.sqlite` |
| Nginx site conf | `C:\Users\Khashayar\.config\herd\config\valet\Nginx\tamasharoom.test.conf` (auto-generated; edit only if rewrites needed) |
| Node version | Herd → Settings → Node → `24.19.0` or `nvm use 24.19.0` |

**Notes:**
- **No Docker/Sail/Laragon:** `compose.yaml` + `docker/` + `C:/laragon` removed — `laravel/sail` remains in `composer.json` as unused dev dep (remove with `composer remove laravel/sail` if desired).
- **No Redis:** `CACHE_STORE=file`, `QUEUE_CONNECTION=sync`, `SESSION_DRIVER=file` — local dev uses file-based drivers for resilience. Production uses `database`.
- `.env` for Herd: `DB_CONNECTION=sqlite`, `APP_URL=https://tamasharoom.test`, no `NO_PROXY` (not needed natively — `hosts` is `127.0.0.1` direct).
- **Herd CE vs Pro:** MySQL services (`herd services:start mysql`) require Herd Pro. Local dev uses SQLite. If you need MySQL locally, install Herd Pro or run MySQL manually on port 3306.
- `vite.config.js` auto-detects Herd's SSL cert/key (`~/.config/herd/config/valet/Certificates/tamasharoom.test.*`) for the dev server, so Chrome trusts port 5173 the same as port 443. Falls back to Vite's self-signed cert if Herd certs are missing (CI). HMR at `wss://tamasharoom.test:5173`.
- **VPN-safe:** `hosts` is `127.0.0.1` + `::1` loopback — works VPN ON/OFF; Herd's Nginx binds `0.0.0.0:80/443` + `[::]:80/443` by default.

### Windows Hosts Configuration

> **Critical:** Incorrect `hosts` entries cause SSL errors, DNS failures, and VPN blocking. Herd CE generates `0.0.0.0` entries which **block** connections instead of redirecting to localhost.

**Correct format** — use ONLY these entries for TamashaRoom:

```
127.0.0.1   localhost
127.0.0.1   tamasharoom.test
::1         tamasharoom.test
127.0.0.1   database.herd.test
```

- **Never use `0.0.0.0`** for domain mapping — it blackholes traffic.
- **Always include both IPv4 (`127.0.0.1`) and IPv6 (`::1`)** for `.test` domains (modern browsers and Node.js resolve both).

**Manual fix (Admin PowerShell):**

```powershell
# 1. Open Notepad as Administrator
# 2. File → Open → C:\Windows\System32\drivers\etc\hosts
# 3. Remove all 0.0.0.0 lines mapped to domain names
# 4. Add the correct entries above
# 5. Save, then flush DNS:
ipconfig /flushdns
```

**Or use the helper script** (gitignored, not committed):

```powershell
# Admin PowerShell
.\scripts\fix-hosts.ps1
ipconfig /flushdns
```

**Verify:**

```powershell
ping -4 tamasharoom.test    # Should resolve to 127.0.0.1
ping -6 tamasharoom.test    # Should resolve to ::1
```

### VPN Compatibility

When VPN is active, Chrome/Edge may route all HTTPS traffic through the tunnel — including local `.test` domains that should resolve to `127.0.0.1`. This causes `ERR_CONNECTION_CLOSED` or `ERR_CONNECTION_TIMED_OUT`.

**Fix — add `.test` to the proxy bypass list:**

1. Win+R → `inetcpl.cpl` → Connections → LAN Settings → Advanced
2. In **"Do not use proxy server for addresses beginning with"**, add:
   ```
   <local>;*.test;localhost;127.*;::1
   ```
3. OK → Apply → Restart browser

**Or use the helper script** (gitignored, not committed):

```powershell
# Admin PowerShell
.\scripts\fix-proxy-bypass.ps1
# Then restart Chrome/Edge
```

**After changing proxy settings, clear Chrome's DNS cache:**

```
chrome://net-internals/#dns    → Clear host cache
chrome://net-internals/#sockets → Flush socket pools
```

**Known regression:** Windows Update, VPN client reconnects, or Happ/Xray proxy reinstall can reset `ProxyOverride` to defaults (removing `*.test`). If the site stops loading with VPN ON after previously working, re-run the bypass script or re-add the entries manually. The `scripts/fix-proxy-bypass.ps1` helper handles this in one command.

**Verify (with VPN ON):**

```powershell
curl -sk https://tamasharoom.test    # Should return HTTP 200
```

---

## Post-Task Health Check

After completing any task, always verify your local environment:

```powershell
.\scripts\verify-local-env.ps1
```

This checks: Hosts file, Proxy bypass (VPN), Herd services, SSL cert, and HTTPS connectivity.

**Never mark a task complete without this check passing.** The post-commit hook runs this automatically.

---

## Troubleshooting Local Errors

| Error | Cause | Fix |
|---|---|---|
| `SQLSTATE[HY000] [2002] No connection could be made` | MySQL not running / Herd CE doesn't support MySQL services | Switch to SQLite: set `DB_CONNECTION=sqlite` in `.env`, run `php artisan migrate` |
| `Herd Pro is required to use services` | Herd CE doesn't include MySQL/Nginx services | Use Herd CE defaults (SQLite, built-in Nginx) or upgrade to Herd Pro |
| `ERR_CERT_AUTHORITY_INVALID` | SSL certificate not trusted | Herd → Sites → `tamasharoom.test` → **Secure** (or `herd secure tamasharoom.test`) |
| `Illuminate\Session\SessionServiceProvider::boot(): Failed to open session` | Session driver depends on missing DB table | Set `SESSION_DRIVER=file` in `.env`, run `php artisan config:clear` |
| `500 Internal Server Error` after fresh clone | Missing `.env` or app key | `cp .env.example .env && php artisan key:generate && php artisan migrate` |
| `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` on `:5173` | Vite's self-signed cert not trusted by Chrome | `vite.config.js` auto-detects Herd's cert/key — restart Vite after `herd secure tamasharoom.test`. If still broken, test in Incognito (`Ctrl+Shift+N`) or clear HSTS: `chrome://net-internals/#hsts` → Delete `tamasharoom.test` |
| `tamasharoom.test` unreachable / DNS_PROBE_FINISHED_NXDOMAIN | `hosts` file has `0.0.0.0` entries (Herd-generated) blocking resolution | Edit `C:\Windows\System32\drivers\etc\hosts` as Admin — remove all `0.0.0.0` lines, add `127.0.0.1 tamasharoom.test` + `::1 tamasharoom.test`. Run `ipconfig /flushdns`. See "Windows Hosts Configuration" above. |
| Vite HMR not connecting | `npm run dev` not running or Vite binds IPv6-only | Run `npm run dev` in Herd terminal. Check `vite.config.js` has `host: '0.0.0.0'`, `https` with Herd cert, and `hmr: { host: 'tamasharoom.test' }` |
| `NVM requires a specific version` in Herd Node settings | Herd's NVM env vars conflict with system Node | Close Herd, remove `NVM_HOME`/`NVM_SYMLINK` from system env vars (Admin PowerShell), restart Herd |
| Port 3306 already in use | Another MySQL instance (XAMPP, Laragon) running | Stop the conflicting service, or change Herd's MySQL port in Settings |
| `ERR_CONNECTION_CLOSED` with VPN ON | VPN routes `.test` traffic through tunnel, bypassing local loopback | Add `*.test` to proxy bypass: Win+R → `inetcpl.cpl` → Connections → LAN Settings → Advanced → "Do not use proxy for" → add `<local>;*.test;localhost;127.*;::1`. Restart browser. See "VPN Compatibility" above. |
| Site loads once with VPN, then breaks again | Windows/VPN client reset `ProxyOverride` to defaults | Re-run `.\scripts\fix-proxy-bypass.ps1` + flush DNS. See "Known regression" note above. |

---

## Proprietary Notice

TamashaRoom is **not open source**. The source code is made publicly viewable on GitHub as a portfolio and reference, but it is not licensed for reuse, forking, modification, or redistribution. All rights are reserved.

You may look, learn, and be inspired — but you may not copy, deploy, or distribute this code or any derivative of it without explicit written permission.
