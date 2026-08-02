<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\DetermineVideoPlaybackModeAction;
use App\Enums\PlaybackMode;
use App\Events\PlaybackStateChanged;
use App\Http\Requests\UpdatePlaybackRequest;
use App\Models\Room;
use App\Services\UrlSecurityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaybackController extends Controller
{
    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
        private readonly DetermineVideoPlaybackModeAction $determineMode,
    ) {}

    public function update(UpdatePlaybackRequest $request, Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $videoUrl = $request->video_url ?? $room->video_url;
        $playbackMode = $room->playback_mode;

        if ($videoUrl !== $room->video_url) {
            if ($videoUrl !== null) {
                $error = $this->urlSecurity->validateVideoUrl($videoUrl);

                if ($error !== null) {
                    return response()->json([
                        'status' => 'error',
                        'message' => $error,
                    ], 422);
                }

                $playbackMode = $this->determineMode->execute($videoUrl);
            } else {
                $playbackMode = PlaybackMode::Proxy;
            }
        }

        $room->updatePlaybackState([
            'is_playing' => $request->is_playing,
            'position_seconds' => $request->position_seconds,
            'duration_seconds' => $request->duration_seconds,
            'playback_rate' => $request->playback_rate ?? 1.0,
            'video_url' => $videoUrl,
            'playback_mode' => $playbackMode,
        ]);

        $room->refresh();

        broadcast(new PlaybackStateChanged($room, $request->user()->id))->toOthers();

        return response()->json([
            'status' => 'ok',
            'state_version' => $room->state_version,
            'server_timestamp' => $room->server_timestamp,
            'playback_mode' => $room->playback_mode?->value ?? PlaybackMode::Proxy->value,
        ]);
    }

    public function setVideo(Request $request, Room $room): JsonResponse
    {
        $this->authorize('setVideo', $room);

        $validated = $request->validate([
            'video_url' => 'required|url',
        ]);

        $videoUrl = $validated['video_url'];

        $error = $this->urlSecurity->validateVideoUrl($videoUrl);

        if ($error !== null) {
            return response()->json([
                'status' => 'error',
                'message' => $error,
            ], 422);
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

        broadcast(new PlaybackStateChanged($room, $request->user()->id))->toOthers();

        return response()->json([
            'status' => 'ok',
            'state_version' => $room->state_version,
            'server_timestamp' => $room->server_timestamp,
            'playback_mode' => $playbackMode,
        ]);
    }

    public function state(Room $room): JsonResponse
    {
        $this->authorize('memberAccess', $room);

        return response()->json([
            'is_playing' => $room->is_playing,
            'position_seconds' => $room->position_seconds,
            'duration_seconds' => $room->duration_seconds,
            'playback_rate' => $room->playback_rate,
            'video_url' => $room->video_url,
            'playback_mode' => $room->playback_mode?->value ?? 'proxy',
            'state_version' => $room->state_version,
            'server_timestamp' => $room->server_timestamp,
            'updated_at' => $room->updated_at,
        ]);
    }
}
