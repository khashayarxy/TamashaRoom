<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://via.placeholder.com/400x100/1e293b/ffffff?text=TamashaRoom">
    <img alt="TamashaRoom" src="https://via.placeholder.com/400x100/ffffff/1e293b?text=TamashaRoom" width="400">
  </picture>
</p>

<p align="center" dir="rtl">
تماشاخونه — هم‌زمان فیلم ببینید
</p>

---

**TamashaRoom** is a synchronized watch-party platform for Persian-speaking users. Create a private room, share the invite link, and watch an external video together — play, pause, seek, and position stay in sync for everyone in the room. No video files are stored on the server; only external links are supported.

## How It Works

1. A user creates a room and provides a video source URL (any external video)
2. An invite link is generated and shared with friends
3. Everyone who joins sees playback synchronized — when the host plays, pauses, or seeks, the change propagates to all members within 1–2 seconds
4. In-room chat, subtitle support, and member presence are included out of the box

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Laravel 13, PHP 8.4, MySQL/MariaDB |
| Frontend | React 19, Inertia.js 2, TypeScript (strict) |
| Styling | Tailwind CSS 4, RTL-first (Persian) |
| State | Zustand (UI), Inertia (server data) |
| Build | Vite 5 |
| Testing | PHPUnit, Vitest + React Testing Library, Playwright |

## Hosting Constraint

TamashaRoom is designed for **shared cPanel hosting** — Apache, PHP 8.4, MySQL, 2 GB RAM, 1 CPU core, 20 GB storage. No Docker, no Redis, no WebSockets, no persistent background workers, no root access.

Playback sync (normally a WebSocket feature) works via polling: state changes are written as broadcastable events, and the frontend polls for them every 1–2 seconds. The architecture is transport-agnostic — migrating to Laravel Reverb on a future VPS means changing `BROADCAST_CONNECTION`, not rewriting the feature.

## Local Setup

```bash
# Clone and install
git clone <repo-url> tamasharoom
cd tamasharoom
composer install
npm install

# Environment
cp .env.example .env
php artisan key:generate

# Database (SQLite for local dev)
touch database/database.sqlite
php artisan migrate

# Development servers
php artisan serve      # Laravel at http://localhost:8000
npm run dev            # Vite HMR
```

## Quality Commands

```bash
npm run lint           # ESLint
npm run type-check     # TypeScript strict check
npm run format         # Prettier
./vendor/bin/pint      # Laravel Pint (PHP)
npm run test           # Vitest (frontend)
php artisan test       # PHPUnit (backend)
```

## Deployment

See `docs/DEPLOYMENT.md` for the production cPanel deployment sequence (migrations, storage symlink, cron, queue worker).

## License

MIT
