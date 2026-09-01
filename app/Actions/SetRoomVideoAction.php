<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlaybackMode;
use App\Events\PlaybackStateChanged;
use App\Models\Room;
use App\Services\MediaCodecDetector;
use App\Services\UrlSecurityService;
use Illuminate\Validation\ValidationException;

class SetRoomVideoAction
{
    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
        private readonly DetermineVideoPlaybackModeAction $determineMode,
        private readonly MediaCodecDetector $codecDetector = new MediaCodecDetector,
    ) {}

    /**
     * Set a new video URL for a room, broadcasting the change.
     *
     * @return array{state_version: int, server_timestamp: float|null, playback_mode: PlaybackMode}
     */
    public function execute(Room $room, string $videoUrl, int $userId): array
    {
        $error = $this->urlSecurity->validateVideoUrl($videoUrl);

        if ($error !== null) {
            throw ValidationException::withMessages([
                'video_url' => $error,
            ]);
        }

        $codecResult = $this->codecDetector->detectFromUrl($videoUrl);
        if ($codecResult->isConfidentlyHEVC()) {
            throw ValidationException::withMessages([
                'video_url' => 'این ویدیو با کدک HEVC/x265 فشرده‌سازی شده که فعلاً پشتیبانی نمی‌شود. لطفاً از فایل‌های MP4 یا MKV با کدک H.264 استفاده کنید.',
            ]);
        }

        $playbackMode = $this->determineMode->execute($videoUrl);

        $room->updatePlaybackState([
            'video_url' => $videoUrl,
            'playback_mode' => $playbackMode->value,
            'position_seconds' => 0,
            'duration_seconds' => 0,
            'is_playing' => false,
            'playback_rate' => 1.0,
        ]);

        $room->refresh();

        broadcast(new PlaybackStateChanged($room, $userId))->toOthers();

        return [
            'state_version' => $room->state_version,
            'server_timestamp' => $room->server_timestamp,
            'playback_mode' => $playbackMode,
        ];
    }
}
