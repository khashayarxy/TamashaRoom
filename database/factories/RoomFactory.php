<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Room>
 */
class RoomFactory extends Factory
{
    protected $model = Room::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->word().' Room',
            'invite_code' => Str::random(12),
            'video_url' => null,
            'is_playing' => false,
            'position_seconds' => 0,
            'duration_seconds' => 0,
            'playback_rate' => 1.0,
            'state_version' => 0,
            'server_timestamp' => null,
            'max_members' => 10,
            'last_activity_at' => now(),
        ];
    }
}
