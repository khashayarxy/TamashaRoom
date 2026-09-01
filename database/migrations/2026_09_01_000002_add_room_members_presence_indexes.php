<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_members', function (Blueprint $table) {
            $table->index(['presence_status', 'last_seen_at'], 'room_members_presence_last_seen_index');
            $table->index(['room_id', 'last_seen_at'], 'room_members_room_last_seen_index');
        });
    }

    public function down(): void
    {
        Schema::table('room_members', function (Blueprint $table) {
            $table->dropIndex('room_members_presence_last_seen_index');
            $table->dropIndex('room_members_room_last_seen_index');
        });
    }
};
