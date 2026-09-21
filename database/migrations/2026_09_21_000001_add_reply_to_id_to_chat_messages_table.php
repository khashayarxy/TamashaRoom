<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // Deliberately NO foreign-key constraint: when the original
            // message is deleted the reference must survive so the reply can
            // render a "deleted message" placeholder instead of silently
            // losing its quote (no FK action preserves the id — cascade
            // deletes the reply, SET NULL destroys the reference, RESTRICT
            // blocks deletion). Same-room integrity is enforced at the
            // application layer in ChatController::store, mirroring the
            // cross-room scoping of ChatController::destroy.
            $table->unsignedBigInteger('reply_to_id')->nullable()->after('body');
            $table->index('reply_to_id');
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropIndex(['reply_to_id']);
            $table->dropColumn('reply_to_id');
        });
    }
};
