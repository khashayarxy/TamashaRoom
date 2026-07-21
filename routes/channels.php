<?php

use App\Models\Room;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('room.{roomId}', function (mixed $user, int $roomId): ?array {
    $room = Room::find($roomId);

    if (! $room) {
        return null;
    }

    if ($user->cannot('memberAccess', $room)) {
        return null;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});
