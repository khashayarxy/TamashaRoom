<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table): void {
            $table->float('playback_rate')->default(1.0)->after('duration_seconds');
            $table->unsignedInteger('state_version')->default(0)->after('playback_rate');
            $table->float('server_timestamp')->nullable()->after('state_version');
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table): void {
            $table->dropColumn(['playback_rate', 'state_version', 'server_timestamp']);
        });
    }
};
