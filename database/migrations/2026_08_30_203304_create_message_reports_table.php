<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('message_id')->constrained('chat_messages')->cascadeOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 100)->nullable();
            $table->text('details')->nullable();
            $table->timestamps();

            $table->unique(['message_id', 'reporter_id']);
            $table->index(['room_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_reports');
    }
};
