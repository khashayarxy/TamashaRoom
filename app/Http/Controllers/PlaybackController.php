<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\SetRoomVideoAction;
use App\Actions\UpdatePlaybackStateAction;
use App\Http\Requests\UpdatePlaybackRequest;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaybackController extends Controller
{
    public function __construct(
        private readonly SetRoomVideoAction $setVideoAction,
        private readonly UpdatePlaybackStateAction $updatePlaybackAction,
    ) {}

    public function update(UpdatePlaybackRequest $request, Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $result = $this->updatePlaybackAction->execute(
            $room,
            $request->validated(),
            $request->user()->id,
        );

        return response()->json(array_merge(['status' => 'ok'], $result));
    }

    public function setVideo(Request $request, Room $room): JsonResponse
    {
        $this->authorize('setVideo', $room);

        $validated = $request->validate([
            'video_url' => 'required|url',
        ]);

        $result = $this->setVideoAction->execute($room, $validated['video_url'], $request->user()->id);

        return response()->json([
            'status' => 'ok',
            'state_version' => $result['state_version'],
            'server_timestamp' => $result['server_timestamp'],
            'playback_mode' => $result['playback_mode'],
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
