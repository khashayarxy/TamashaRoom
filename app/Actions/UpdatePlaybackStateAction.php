<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlaybackMode;
use App\Events\PlaybackStateChanged;
use App\Models\Room;
use App\Services\UrlSecurityService;
use Illuminate\Validation\ValidationException;

class UpdatePlaybackStateAction
{
    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
        private readonly DetermineVideoPlaybackModeAction $determineMode,
    ) {}

    /**
     * @param  array{is_playing: bool, position_seconds: float, duration_seconds: float, playback_rate?: float, video_url?: string|null}  $data
     * @return array{state_version: int, server_timestamp: float, playback_mode: string}
     */
    public function execute(Room $room, array $data, int $userId): array
    {
        $videoUrl = $data['video_url'] ?? $room->video_url;
        $playbackMode = $room->playback_mode;

        if (array_key_exists('video_url', $data) && $videoUrl !== $room->video_url) {
            if ($videoUrl !== null) {
                $error = $this->urlSecurity->validateVideoUrl($videoUrl);

                if ($error !== null) {
                    throw ValidationException::withMessages([
                        'video_url' => [$error],
                    ]);
                }

                $playbackMode = $this->determineMode->execute($videoUrl);
            } else {
                $playbackMode = PlaybackMode::Proxy;
            }
        }

        $room->updatePlaybackState([
            'is_playing' => $data['is_playing'],
            'position_seconds' => $data['position_seconds'],
            'duration_seconds' => $data['duration_seconds'],
            'playback_rate' => $data['playback_rate'] ?? 1.0,
            'video_url' => $videoUrl,
            'playback_mode' => $playbackMode,
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
