<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlaybackMode;
use App\Events\PlaybackStateChanged;
use App\Events\SubtitleDefaultChanged;
use App\Models\Room;
use App\Models\SubtitleTrack;
use App\Services\EmbeddedTrack;
use App\Services\EmbeddedTrackDetector;
use App\Services\MediaCodecDetector;
use App\Services\UrlSecurityService;
use Illuminate\Validation\ValidationException;

class SetRoomVideoAction
{
    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
        private readonly DetermineVideoPlaybackModeAction $determineMode,
        private readonly MediaCodecDetector $codecDetector,
        private readonly EmbeddedTrackDetector $embeddedDetector,
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

        $this->refreshEmbeddedSubtitles($room, $videoUrl, $userId);

        $room->refresh();

        broadcast(new PlaybackStateChanged($room, $userId))->toOthers();

        return [
            'state_version' => $room->state_version,
            'server_timestamp' => $room->server_timestamp,
            'playback_mode' => $playbackMode,
        ];
    }

    /**
     * Replace the room's embedded subtitle rows with the tracks detected in
     * the new video, and auto-apply the preferred one (Persian first) as the
     * room default. Stale rows from the previous video must go — their track
     * indexes belong to a different container. Broadcasts only when the
     * effective default changed, so re-setting an equivalent video stays
     * quiet for members following the default.
     */
    private function refreshEmbeddedSubtitles(Room $room, string $videoUrl, int $userId): void
    {
        $previousDefaultId = $room->active_subtitle_track_id;
        $previousWasEmbedded = $previousDefaultId !== null
            && SubtitleTrack::whereKey($previousDefaultId)
                ->where('kind', SubtitleTrack::KIND_EMBEDDED)
                ->exists();

        $room->subtitleTracks()
            ->where('kind', SubtitleTrack::KIND_EMBEDDED)
            ->delete();

        $detected = array_values(array_filter(
            $this->embeddedDetector->detectFromUrl($videoUrl),
            static fn ($track): bool => $track->kind === 'subtitle',
        ));

        if ($detected !== []) {
            $byIndex = [];
            foreach ($detected as $track) {
                $row = SubtitleTrack::create([
                    'room_id' => $room->id,
                    'user_id' => null,
                    'kind' => SubtitleTrack::KIND_EMBEDDED,
                    'track_index' => $track->index,
                    'label' => $track->label ?? $this->embeddedTrackLabel($track),
                    'language' => $track->language !== null ? mb_substr($track->language, 0, 10) : 'und',
                    'file_path' => '',
                    'original_extension' => $track->container ?? 'mp4',
                ]);
                $byIndex[$row->track_index] = $row->id;
            }

            $picked = EmbeddedTrackDetector::pickDefaultSubtitle($detected);
            $defaultId = ($picked !== null && isset($byIndex[$picked->index]))
                ? $byIndex[$picked->index]
                : null;

            // Freshly detected tracks take over the default (that's the
            // feature); broadcast only on actual change to stay quiet when
            // re-setting an equivalent video.
            if ($defaultId !== $previousDefaultId) {
                $room->update(['active_subtitle_track_id' => $defaultId]);
                broadcast(new SubtitleDefaultChanged($room, $defaultId, $userId))->toOthers();
            }

            return;
        }

        // No detectable tracks: an upload default stays valid untouched, but
        // a stale embedded default (its rows were just deleted; the FK's
        // nullOnDelete already nulled the column) must broadcast so members
        // following it stop too.
        if ($previousWasEmbedded) {
            $room->update(['active_subtitle_track_id' => null]);
            broadcast(new SubtitleDefaultChanged($room, null, $userId))->toOthers();
        }
    }

    private function embeddedTrackLabel(EmbeddedTrack $track): string
    {
        if ($track->language !== null && $track->language !== '') {
            return 'Embedded ('.mb_strtoupper(mb_substr($track->language, 0, 10)).')';
        }

        return 'Embedded track '.($track->index + 1);
    }
}
