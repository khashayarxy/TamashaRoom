<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subtitle_tracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('label');
            $table->string('language', 10)->default('fa');
            $table->string('file_path');
            $table->string('original_extension', 10);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subtitle_tracks');
    }
};
