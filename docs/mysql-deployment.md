# TamashaRoom — MySQL Production Deployment

**Date:** 2026-08-07
**Schema file:** `database/tamasharoom.sql`
**Scope:** SQLite → MySQL production schema (DDL only). Application logic unchanged.

> **Previous artifact replaced:** the first schema draft was removed in favor of
> `database/tamasharoom.sql` after an import failure (`#1005 / errno 150 "Foreign key
> constraint is incorrectly formed"`). See "Why the previous SQL failed" below.

---

## Source of truth

Built **exclusively** from the Laravel migrations in `database/migrations/**`.
No SQLite file and no live MySQL server were inspected. The migrations alone define:

- **users** — `0001_01_01_000000`
- **password_reset_tokens** — `0001_01_01_000000`
- **sessions** — `0001_01_01_000000`
- **cache**, **cache_locks** — `0001_01_01_000001`
- **jobs**, **job_batches**, **failed_jobs** — `0001_01_01_000002`
- **rooms** — `2026_07_20_000001` + alters `000004`, `000007`, `2026_07_21_000000`, `2026_07_21_000001`, `2026_08_03_000000`
- **room_members** — `2026_07_20_000002` + alter `2026_07_20_000006`
- **chat_messages** — `2026_07_20_000003`
- **subtitle_tracks** — `2026_07_20_000005`
- **personal_access_tokens** — `2026_07_22_093343`
- **migrations** (repo table) — Laravel framework default

There is **no** independent `playback_states` table — playback state is stored on
`rooms` (`is_playing`, `position_seconds`, `duration_seconds`, `playback_rate`,
`state_version`, `server_timestamp`). `cache_locks` **is** required (database
cache store).

---

## Table dependency order (parents before children in CREATE; FKs deferred)

**Phase 1 order (create tables, no FKs):**

```
migrations  users  password_reset_tokens  sessions  cache  cache_locks
jobs  job_batches  failed_jobs
rooms  subtitle_tracks  room_members  chat_messages  personal_access_tokens
```

Because foreign keys are **not inline**, order among app tables is largely cosmetic,
but for reference the semantic parent/child graph is:

| Table | Parent(s) | Notes |
|-------|-----------|-------|
| `rooms` | `users` | `user_id` -> users |
| `subtitle_tracks` | `rooms`, `users` | also a **parent** of `rooms.active_subtitle_track_id` (circular) |
| `room_members` | `rooms`, `users` | |
| `chat_messages` | `rooms`, `users` | |
| `personal_access_tokens` | (polymorphic, no FK) | `tokenable` is morphs |

---

## Why the previous SQL failed

`#1005 (errno 150)` on `subtitle_tracks` occurred because the old
`schema_mysql.sql`:

1. **Declared FKs inline inside `CREATE TABLE`**, and
2. **placed `subtitle_tracks` before `rooms`** while `subtitle_tracks`
   references `rooms(id)`.

MySQL rejects a `FOREIGN KEY` whose referenced (parent) table does not yet exist.
At the moment `subtitle_tracks` was created, `rooms` had not been created yet, so
the FK was "incorrectly formed" and the whole `CREATE TABLE` rolled back.

The old file also relied on `SET FOREIGN_KEY_CHECKS=0` to paper over this, which is
fragile under phpMyAdmin's session handling and is not a correct model — the fix is
structural, not a session toggle.

---

## How `tamasharoom.sql` fixes it (correct approach)

1. **Phase 1 — create all tables with NO foreign keys.** No `CREATE TABLE` contains
   `REFERENCES`, so there is no forward reference possible at create time.
2. **Phase 2 — after every table exists, attach all FKs** via
   `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. By then every referenced
   parent table exists, so MySQL accepts them.
3. This also resolves the **circular dependency** `rooms ↔ subtitle_tracks`
   (both tables exist before either FK is added).
4. `FOREIGN_KEY_CHECKS` is still toggled per phase as defense-in-depth for
   inconsistent host session settings, but the ordering no longer depends on it.
5. Own nullable FKs are set to `ON DELETE SET NULL`; NOT NULL FKs to `ON DELETE
   CASCADE`, matching the migrations exactly.

---

## Verification of every FK / index / unique / cascade / nullable

### Foreign keys (8 total) — all match their migration
| FK | Child column | Parent | on delete | Migration |
|----|--------------|--------|-----------|-----------|
| `rooms_user_id_foreign` | `rooms.user_id` (NOT NULL) | `users` | CASCADE | 000001 |
| `rooms_active_subtitle_track_id_foreign` | `rooms.active_subtitle_track_id` (NULL) | `subtitle_tracks` | SET NULL | 2026_08_03 |
| `subtitle_tracks_room_id_foreign` | `subtitle_tracks.room_id` (NOT NULL) | `rooms` | CASCADE | 000005 |
| `subtitle_tracks_user_id_foreign` | `subtitle_tracks.user_id` (NULL) | `users` | SET NULL | 000005 |
| `room_members_room_id_foreign` | `room_members.room_id` (NOT NULL) | `rooms` | CASCADE | 000002 |
| `room_members_user_id_foreign` | `room_members.user_id` (NOT NULL) | `users` | CASCADE | 000002 |
| `chat_messages_room_id_foreign` | `chat_messages.room_id` (NOT NULL) | `rooms` | CASCADE | 000003 |
| `chat_messages_user_id_foreign` | `chat_messages.user_id` (NOT NULL) | `users` | CASCADE | 000003 |

### Unique constraints
- `users_email_unique` (`users.email`)
- `rooms_invite_code_unique` (`rooms.invite_code`)
- `room_members_room_id_user_id_unique` (`room_members(room_id, user_id)`)
- `failed_jobs_uuid_unique` (`failed_jobs.uuid`)
- `personal_access_tokens_token_unique` (`personal_access_tokens.token`)

### Secondary / composite indexes
- `sessions_user_id_index`, `sessions_last_activity_index`
- `cache_expiration_index`, `cache_locks_expiration_index`
- `jobs_queue_index`
- `failed_jobs_connection_queue_failed_at_index` (composite)
- `rooms_user_id_index`, `rooms_active_subtitle_track_id_index`,
  `rooms_last_activity_at_index`
- `subtitle_tracks_room_id_index`, `subtitle_tracks_user_id_index`
- `room_members_room_id_index`, `room_members_user_id_index`
- `chat_messages_room_id_index`, `chat_messages_user_id_index`
- `personal_access_tokens_tokenable_type_tokenable_id_index` (morphs),
  `personal_access_tokens_expires_at_index`

### Primary keys
- `users.id`, `rooms.id`, `subtitle_tracks.id`, `room_members.id`,
  `chat_messages.id`, `personal_access_tokens.id`, `jobs.id`, `failed_jobs.id`,
  `migrations.id` (auto-increment); string PKs: `password_reset_tokens.email`,
  `sessions.id`, `cache.key`, `cache_locks.key`, `job_batches.id`.

---

## Import instructions (phpMyAdmin)

1. cPanel → **MySQL Databases** → create DB + user, grant `ALL PRIVILEGES`.
2. **phpMyAdmin** → select target DB → **Import** → choose `database/tamasharoom.sql`
   → **Go**.
3. Confirm all **14 tables** appear in the sidebar.

### Verify

```bash
# Connection + driver
php artisan about --only=drivers

# Migrations listed (the repo table is present)
php artisan migrate:status
```

---

## Post-import artisan commands

```bash
php artisan key:generate            # if no APP_KEY in .env
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link            # public disk (if used)
```

Set the production `.env` (server-only, never committed):

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=zizolean_tamasharoom
DB_USERNAME=zizolveer_tamasharoom
DB_PASSWORD=***
```

Do **not** run `php artisan migrate` against an already-imported DB (tables exist);
run it only to bootstrap a fresh DB from scratch, in which case
`php artisan migrate` (not the SQL file) is the preferred path.

---

## Clean import into an EMPTY MySQL database (mental simulation)

```
1. SET NAMES utf8mb4;
2. SET FOREIGN_KEY_CHECKS=0
3. CREATE TABLE migrations        # no FK
   CREATE TABLE users ...
   ... rooms (no FK) ... subtitle (no FK) ... room_members ... chat_messages ... personal_access_tokens
4. SET FOREIGN_KEY_CHECKS=1
5. SET FOREIGN_KEY_CHECKS=0
   ALTER rooms  -> add FKs (users, subtitle_tracks both exist ✓)
   ALTER subtitle_tracks -> add FKs (rooms, users both exist ✓)
   ALTER room_members -> add FKs (rooms, users exist ✓)
   ALTER chat_messages -> add FKs (rooms, users exist ✓)
6. SET FOREIGN_KEY_CHECKS=1
```

**No `CREATE TABLE` references a `ALTER TABLE`-created / not-yet-created table; no forward
references anywhere.** Verified with the regex: 0 inline `REFERENCES` in any CREATE block;
8 `REFERENCES` in the ALTER phase, each backed by a table that exists in Phase 1. Import
is expected to complete with zero errors.

> Live runtime test was not run because this development machine has no local
> MySQL/MariaDB server, `mysql` CLI, or Docker. The file was verified structurally
> (dependency order + FK/index/unique/cascade/nullability parity against the
> migrations) and by the mental import simulation above.