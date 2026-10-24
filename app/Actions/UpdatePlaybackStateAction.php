<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlaybackMode;
use App\Events\PlaybackStateChanged;
use App\Models\Room;
use Illuminate\Validation\ValidationException;

class UpdatePlaybackStateAction
{
    /**
     * @param  array{is_playing: bool, position_seconds: float, duration_seconds: float, playback_rate?: float}  $data
     * @return array{state_version: int, server_timestamp: float, playback_mode: string}
     */
    public function execute(Room $room, array $data, int $userId): array
    {
        // Source changes have a separate owner-authorized action, including
        // codec/subtitle handling. Reject the key even for internal callers.
        if (array_key_exists('video_url', $data)) {
            throw ValidationException::withMessages([
                'video_url' => 'برای تغییر ویدیو از تنظیم منبع اتاق استفاده کنید.',
            ]);
        }

        $room->updatePlaybackState([
            'is_playing' => $data['is_playing'],
            'position_seconds' => $data['position_seconds'],
            'duration_seconds' => $data['duration_seconds'],
            'playback_rate' => $data['playback_rate'] ?? 1.0,
        ]);

        $room->refresh();

        broadcast(new PlaybackStateChanged($room, $userId))->toOthers();

        return [
            'state_version' => $room->state_version,
            'server_timestamp' => $room->server_timestamp,
            'playback_mode' => $room->playback_mode?->value ?? PlaybackMode::Proxy->value,
        ];
    }
}
