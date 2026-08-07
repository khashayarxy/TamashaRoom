<?php

use App\Models\Room;
use App\Models\RoomMember;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;

Broadcast::channel('room.{roomId}', function (mixed $user, int $roomId): ?array {
    $room = Room::find($roomId);

    if (! $room) {
        return null;
    }

    if ($user->cannot('memberAccess', $room)) {
        return null;
    }

    $member = RoomMember::where('room_id', $room->id)
        ->where('user_id', $user->id)
        ->first();

    if ($member === null) {
        return null;
    }

    // Connection-count monitoring against the free tier ceiling (see TASK.md
    // "Step 3"). Every presence-channel subscription lands here; the pusher.log
    // stream plus `pusher:usage` give a per-room view of concurrent members.
    Log::channel('pusher')->info('pusher.channel.joined', [
        'room_id' => $room->id,
        'user_id' => $user->id,
        'member_id' => $member->id,
        'at' => now()->toIso8601String(),
    ]);

    // Mirror PresenceService::getPresence exactly so the presence channel
    // user_info, GET /presence/{room}, and MemberPresenceChanged payloads all
    // share one member shape on the client. `id` is the room_member id (unique
    // per room), which is also a valid presence-channel member identity.
    return [
        'id' => $member->id,
        'user_id' => $member->user_id,
        'name' => $user->name,
        'presence_status' => $member->presence_status,
        'last_seen_at' => $member->last_seen_at?->toISOString(),
        'disconnected_at' => $member->disconnected_at?->toISOString(),
        'joined_at' => $member->created_at->toISOString(),
        'is_owner' => $member->user_id === $room->user_id,
    ];
});
