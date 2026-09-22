<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subtitle_tracks', function (Blueprint $table) {
            // 'upload' rows carry a converted VTT file; 'embedded' rows
            // reference a subtitle track inside the room's video container.
            // Embedded rows store file_path as '' (the column stays NOT NULL
            // because doctrine/dbal isn't installed for nullable()->change();
            // all file-touching paths treat '' as absent).
            $table->string('kind', 16)->default('upload')->after('user_id');
            // 0-based position among same-kind embedded tracks, used by the
            // client to pick the nth native TextTrack as a fallback when
            // languages are missing or ambiguous.
            $table->unsignedInteger('track_index')->nullable()->after('kind');
        });
    }

    public function down(): void
    {
        Schema::table('subtitle_tracks', function (Blueprint $table) {
            $table->dropColumn(['kind', 'track_index']);
        });
    }
};
