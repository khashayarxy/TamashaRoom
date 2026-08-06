-- =====================================================================
-- TamashaRoom — MySQL production schema (tamasharoom.sql)
-- =====================================================================
-- Generated purely from the Laravel migrations in database/migrations/
-- (single source of truth). No SQLite or live MySQL was inspected.
-- Charset: utf8mb4 / utf8mb4_unicode_ci   Engine: InnoDB   No data.
--
-- Import strategy (zero forward references):
--   1. All tables are CREATEd WITHOUT inline foreign keys (child tables may
--      appear before, after, or anywhere relative to their parents).
--   2. Only AFTER every table exists are the foreign keys attached via
--      ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY.
--   3. This also lets the circular dependency rooms <-> subtitle_tracks be
--      formed safely (both tables exist before either FK is added).
--   4. FOREIGN_KEY_CHECKS is toggled around each phase purely as defense in
--      depth against host PHPMyAdmin session quirks.
--
-- Import into phpMyAdmin against an EMPTY database. No data included.
-- =====================================================================

SET NAMES utf8mb4;

-- =====================================================================
-- PHASE 1 — CREATE every table WITHOUT foreign-key constraints
-- =====================================================================
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------
-- Framework / infrastructure tables
-- ---------------------------------------------------------------

-- Laravel migration repository table.
CREATE TABLE `migrations` (
    `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `migration` VARCHAR(255) NOT NULL,
    `batch`     INT          NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `users` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`              VARCHAR(255)    NOT NULL,
    `email`             VARCHAR(255)    NOT NULL,
    `email_verified_at` TIMESTAMP       NULL,
    `password`          VARCHAR(255)    NOT NULL,
    `remember_token`    VARCHAR(100)    NULL,
    `created_at`        TIMESTAMP       NULL,
    `updated_at`        TIMESTAMP       NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `users_email_unique` (`email`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
    `email`      VARCHAR(255) NOT NULL,
    `token`      VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP    NULL,
    PRIMARY KEY (`email`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
    `id`            VARCHAR(255) NOT NULL,
    `user_id`       BIGINT UNSIGNED NULL,
    `ip_address`    VARCHAR(45)  NULL,
    `user_agent`    TEXT         NULL,
    `payload`       LONGTEXT     NOT NULL,
    `last_activity` INT          NOT NULL,
    PRIMARY KEY (`id`),
    KEY `sessions_user_id_index` (`user_id`),
    KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `cache` (
    `key`        VARCHAR(255) NOT NULL,
    `value`      MEDIUMTEXT   NOT NULL,
    `expiration` BIGINT       NOT NULL,
    PRIMARY KEY (`key`),
    KEY `cache_expiration_index` (`expiration`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `cache_locks` (
    `key`        VARCHAR(255) NOT NULL,
    `owner`      VARCHAR(255) NOT NULL,
    `expiration` BIGINT       NOT NULL,
    PRIMARY KEY (`key`),
    KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `jobs` (
    `id`           BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
    `queue`        VARCHAR(255)      NOT NULL,
    `payload`      LONGTEXT          NOT NULL,
    `attempts`     SMALLINT UNSIGNED NOT NULL,
    `reserved_at`  INT UNSIGNED      NULL,
    `available_at` INT UNSIGNED      NOT NULL,
    `created_at`   INT UNSIGNED      NOT NULL,
    PRIMARY KEY (`id`),
    KEY `jobs_queue_index` (`queue`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `job_batches` (
    `id`             VARCHAR(255) NOT NULL,
    `name`           VARCHAR(255) NOT NULL,
    `total_jobs`     INT          NOT NULL,
    `pending_jobs`   INT          NOT NULL,
    `failed_jobs`    INT          NOT NULL,
    `failed_job_ids` LONGTEXT     NOT NULL,
    `options`        MEDIUMTEXT   NULL,
    `cancelled_at`   INT          NULL,
    `created_at`     INT          NOT NULL,
    `finished_at`    INT          NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `failed_jobs` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid`       VARCHAR(255)    NOT NULL,
    `connection` VARCHAR(255)    NOT NULL,
    `queue`      VARCHAR(255)    NOT NULL,
    `payload`    LONGTEXT        NOT NULL,
    `exception`  LONGTEXT        NOT NULL,
    `failed_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
    KEY `failed_jobs_connection_queue_failed_at_index` (`connection`, `queue`, `failed_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- Application tables (all columns; no foreign keys yet)
-- ---------------------------------------------------------------

-- Parent: `rooms`  (child of `users`)
CREATE TABLE `rooms` (
    `id`                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`                 BIGINT UNSIGNED NOT NULL,
    `name`                    VARCHAR(255)    NOT NULL,
    `invite_code`             VARCHAR(12)     NOT NULL,
    `video_url`               VARCHAR(255)    NULL,
    `playback_mode`           VARCHAR(8)      NOT NULL DEFAULT 'proxy',
    `is_playing`              TINYINT(1)      NOT NULL DEFAULT 0,
    `position_seconds`        DOUBLE          NOT NULL DEFAULT 0,
    `duration_seconds`        DOUBLE          NOT NULL DEFAULT 0,
    `playback_rate`           DOUBLE          NOT NULL DEFAULT 1.0,
    `state_version`           INT UNSIGNED    NOT NULL DEFAULT 0,
    `server_timestamp`        DOUBLE          NULL,
    `max_members`             INT             NOT NULL DEFAULT 10,
    `last_activity_at`        TIMESTAMP       NULL,
    `is_locked`               TINYINT(1)      NOT NULL DEFAULT 0,
    `active_subtitle_track_id` BIGINT UNSIGNED NULL,
    `created_at`              TIMESTAMP       NULL,
    `updated_at`              TIMESTAMP       NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `rooms_invite_code_unique` (`invite_code`),
    KEY `rooms_user_id_index` (`user_id`),
    KEY `rooms_active_subtitle_track_id_index` (`active_subtitle_track_id`),
    KEY `rooms_last_activity_at_index` (`last_activity_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Parent/child of `rooms`; parent of `rooms.active_subtitle_track_id`
CREATE TABLE `subtitle_tracks` (
    `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id`            BIGINT UNSIGNED NOT NULL,
    `user_id`            BIGINT UNSIGNED NULL,
    `label`              VARCHAR(255)    NOT NULL,
    `language`           VARCHAR(10)     NOT NULL DEFAULT 'fa',
    `file_path`          VARCHAR(255)    NOT NULL,
    `original_extension` VARCHAR(10)     NOT NULL,
    `created_at`         TIMESTAMP       NULL,
    `updated_at`         TIMESTAMP       NULL,
    PRIMARY KEY (`id`),
    KEY `subtitle_tracks_room_id_index` (`room_id`),
    KEY `subtitle_tracks_user_id_index` (`user_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Child of `rooms` and `users`
CREATE TABLE `room_members` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id`           BIGINT UNSIGNED NOT NULL,
    `user_id`           BIGINT UNSIGNED NOT NULL,
    `last_seen_at`      TIMESTAMP       NOT NULL,
    `presence_status`   VARCHAR(20)     NOT NULL DEFAULT 'offline',
    `heartbeat_version` INT UNSIGNED    NOT NULL DEFAULT 0,
    `joined_at`         TIMESTAMP       NULL,
    `disconnected_at`   TIMESTAMP       NULL,
    `created_at`        TIMESTAMP       NULL,
    `updated_at`        TIMESTAMP       NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `room_members_room_id_user_id_unique` (`room_id`, `user_id`),
    KEY `room_members_room_id_index` (`room_id`),
    KEY `room_members_user_id_index` (`user_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Child of `rooms` and `users`
CREATE TABLE `chat_messages` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id`    BIGINT UNSIGNED NOT NULL,
    `user_id`    BIGINT UNSIGNED NOT NULL,
    `body`       TEXT            NOT NULL,
    `created_at` TIMESTAMP       NULL,
    `updated_at` TIMESTAMP       NULL,
    PRIMARY KEY (`id`),
    KEY `chat_messages_room_id_index` (`room_id`),
    KEY `chat_messages_user_id_index` (`user_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Polymorphic token table (Sanctum); has TIMESTAMP_typed columns only
CREATE TABLE `personal_access_tokens` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tokenable_type` VARCHAR(255)    NOT NULL,
    `tokenable_id`   BIGINT UNSIGNED NOT NULL,
    `name`           TEXT            NOT NULL,
    `token`          VARCHAR(64)     NOT NULL,
    `abilities`      TEXT            NULL,
    `last_used_at`   TIMESTAMP       NULL,
    `expires_at`     TIMESTAMP       NULL,
    `created_at`     TIMESTAMP       NULL,
    `updated_at`     TIMESTAMP       NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
    KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`, `tokenable_id`),
    KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- PHASE 2 — Create all foreign keys AFTER every table exists
-- =====================================================================
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `rooms`
    ADD CONSTRAINT `rooms_user_id_foreign`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `rooms_active_subtitle_track_id_foreign`
        FOREIGN KEY (`active_subtitle_track_id`) REFERENCES `subtitle_tracks` (`id`) ON DELETE SET NULL;

ALTER TABLE `subtitle_tracks`
    ADD CONSTRAINT `subtitle_tracks_room_id_foreign`
        FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `subtitle_tracks_user_id_foreign`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `room_members`
    ADD CONSTRAINT `room_members_room_id_foreign`
        FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `room_members_user_id_foreign`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `chat_messages`
    ADD CONSTRAINT `chat_messages_room_id_foreign`
        FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `chat_messages_user_id_foreign`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- PHASE 3 — sanity (no-op if UTF-8 is the session default)
-- =====================================================================
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;