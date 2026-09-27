# TamashaRoom — Local Development (Herd/Windows)

Canonical local domain: `https://tamasharoom.test` (explicit Herd link
with SSL). Do NOT park the project root: `herd park` auto-creates one
junk `.test` domain per subdirectory (`.git.test`, `vendor.test`,
`storage.test`, ...). If the root is parked, remove it with
`herd forget <project-path>`; the explicit `tamasharoom` link keeps
serving and is the only domain this project needs.

Toolchain: Node 24 (see `.nvmrc`), PHP 8.4 via Herd.

## Rebuilding frontend assets

After any `npm run build` while Herd is serving, restart Herd
(`herd restart`) before reloading the page. Vite wipes `outDir` and
removes the old hashed assets, but Herd's long-lived PHP-FPM workers keep
the previous manifest in memory and will render now-deleted asset URLs,
producing 404s on the site's own JS/CSS until workers recycle. Symptom:
HTML 200 but `app-*.js` / `app-*.css` 404. Fix: `herd restart`.

## Never cache config/routes/views locally

Do NOT run `php artisan config:cache`, `route:cache`, or `view:cache` in
local dev. A stale `bootstrap/cache/config.php` pins `APP_ENV=local` inside
the test process (phpunit.xml `<env>` cannot override it), so CSRF stays
enforced and **every state-changing feature test fails with 419** (GETs
still pass — the signature of this exact problem). A stale route cache
additionally masks route changes. Symptom check: a probe test printing
`app()->environment()` shows `local` under `php artisan test`. Fix:
`php artisan config:clear && php artisan route:clear && php artisan view:clear`
(2026-09-22: this exact failure cost a full PlaybackSyncTest file before the
cause was found).

## Quick health checklist

- `curl -sk -sSI https://tamasharoom.test/` returns HTTP 200.
- Referenced `build/assets/*` URLs return 200.
- `php artisan migrate --force` reports nothing to migrate.
