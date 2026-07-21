<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_members', function (Blueprint $table): void {
            $table->string('presence_status', 20)->default('offline')->after('last_seen_at');
            $table->unsignedInteger('heartbeat_version')->default(0)->after('presence_status');
            $table->timestamp('joined_at')->nullable()->after('heartbeat_version');
            $table->timestamp('disconnected_at')->nullable()->after('joined_at');
        });
    }

    public function down(): void
    {
        Schema::table('room_members', function (Blueprint $table): void {
            $table->dropColumn(['presence_status', 'heartbeat_version', 'joined_at', 'disconnected_at']);
        });
    }
};
