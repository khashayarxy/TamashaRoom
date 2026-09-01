# Deployment Rollback Procedure

## When to Rollback

- Health check returns 503 after deploy
- Sentry reports spike in errors within 5 minutes of deploy
- Users report critical functionality broken

## Step-by-Step Rollback

### 1. Code Rollback

```bash
cd /path/to/tamasharoom
git log --oneline -5  # Identify last good commit
git checkout <good-sha>
composer install --no-dev --optimize-autoloader
npm ci
npm run build
```

### 2. Migration Rollback (if needed)

```bash
php artisan migrate:rollback --step=1
# OR specific migration:
php artisan migrate:rollback --path=database/migrations/2026_XX_XX_migration_name.php
```

### 3. Cache Clear

```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

### 4. Verify

```bash
curl https://tamasharoom.ir/api/health
php artisan test
```

### 5. Post-Mortem

After rollback, create incident report using template in `docs/INCIDENT_TEMPLATE.md`.
