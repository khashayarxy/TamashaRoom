# Database Restore Procedure

## SQLite (Local)

```bash
cp storage/app/backups/backup_YYYY_MM_DD_His.sql database/database.sqlite
php artisan migrate:status  # Verify migrations
```

## MySQL (Production)

```bash
mysql -u root -p tamasharoom < storage/app/backups/backup_YYYY_MM_DD_His.sql
php artisan migrate:status
```

## Post-Restore Checklist

- [ ] Verify `php artisan test` passes
- [ ] Check `audit_logs` for anomalies
- [ ] Restart Herd services
