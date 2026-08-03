<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->foreignId('active_subtitle_track_id')
                ->nullable()
                ->after('is_locked')
                ->constrained('subtitle_tracks')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropForeign(['active_subtitle_track_id']);
            $table->dropColumn('active_subtitle_track_id');
        });
    }
};
