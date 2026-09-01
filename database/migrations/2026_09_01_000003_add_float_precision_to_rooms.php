<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite uses dynamic typing and already stores these as REAL/NUMERIC
        // with sufficient precision; the precision fix is for MySQL production.
        // Use raw statements for MySQL and skip on SQLite to avoid requiring
        // doctrine/dbal for ->change().
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE rooms MODIFY COLUMN position_seconds DECIMAL(8,3) NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE rooms MODIFY COLUMN duration_seconds DECIMAL(8,3) NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE rooms MODIFY COLUMN playback_rate DECIMAL(4,2) NOT NULL DEFAULT 1.00');
        DB::statement('ALTER TABLE rooms MODIFY COLUMN server_timestamp DOUBLE NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE rooms MODIFY COLUMN position_seconds FLOAT NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE rooms MODIFY COLUMN duration_seconds FLOAT NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE rooms MODIFY COLUMN playback_rate FLOAT NOT NULL DEFAULT 1');
        DB::statement('ALTER TABLE rooms MODIFY COLUMN server_timestamp FLOAT NULL');
    }
};
