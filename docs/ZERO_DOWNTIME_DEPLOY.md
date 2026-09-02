# Zero-Downtime Deployment Strategy

## Current State (Shared cPanel)
- Method: `git pull` + `npm run build` in place
- Downtime: 5-15 seconds during build
- Risk: Users see broken assets during build window

## Future State (VPS/Symlink)
- Method: Atomic symlink swap
- Downtime: 0 seconds

## Directory Structure
```
/var/www/tamasharoom/
├── releases/
│   ├── 20260901_120000/  (current)
│   ├── 20260901_110000/  (previous)
│   └── ...
├── shared/
│   ├── .env
│   ├── storage/
│   └── node_modules/
└── current -> releases/20260901_120000  (symlink)
```

## Deployment Script (deploy.sh)
```bash
#!/bin/bash
set -e

RELEASE_DIR="releases/$(date +%Y%m%d_%H%M%S)"
SHARED_DIR="shared"

# 1. Clone new release
git clone --depth 1 https://github.com/user/tamasharoom.git $RELEASE_DIR

# 2. Link shared files
ln -s ../../$SHARED_DIR/.env $RELEASE_DIR/.env
ln -s ../../$SHARED_DIR/storage $RELEASE_DIR/storage
ln -s ../../$SHARED_DIR/node_modules $RELEASE_DIR/node_modules

# 3. Install dependencies
cd $RELEASE_DIR
composer install --no-dev --optimize-autoloader
npm ci
npm run build

# 4. Run migrations
php artisan migrate --force

# 5. Atomic symlink swap
ln -sfn $RELEASE_DIR current.tmp
mv -Tf current.tmp current

# 6. Reload PHP-FPM (if applicable)
# sudo systemctl reload php-fpm

# 7. Cleanup old releases (keep last 5)
ls -dt releases/* | tail -n +6 | xargs rm -rf

echo "✅ Deployed $RELEASE_DIR"
```

## Rollback
```bash
# Point symlink to previous release
ln -sfn releases/PREVIOUS_RELEASE current
```
