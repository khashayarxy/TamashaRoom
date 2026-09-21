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

## Quick health checklist

- `curl -sk -sSI https://tamasharoom.test/` returns HTTP 200.
- Referenced `build/assets/*` URLs return 200.
- `php artisan migrate --force` reports nothing to migrate.
