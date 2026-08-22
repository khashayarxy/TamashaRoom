<?php

declare(strict_types=1);

namespace App\Services;

use App\Events\MemberPresenceChanged;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Support\Collection;

class PresenceService
{
    /**
     * How long after a member's last heartbeat they are considered stale.
     * Single source of truth for the stale sweep (presence:timeout) and the
     * room-capacity window (Room::isFull).
     */
    public const STALE_TIMEOUT_SECONDS = 90;

    public function heartbeat(Room $room, User $user): RoomMember
    {
        $member = RoomMember::where('room_id', $room->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $member->update([
            'last_seen_at' => now(),
            'presence_status' => 'online',
            'heartbeat_version' => $member->heartbeat_version + 1,
        ]);

        $room->touchActivityIfStale();

        $this->dispatchPresenceEvent($room);

        return $member->fresh();
    }

    public function leave(Room $room, User $user): void
    {
        RoomMember::where('room_id', $room->id)
            ->where('user_id', $user->id)
            ->update([
                'presence_status' => 'offline',
                'disconnected_at' => now(),
            ]);

        $this->dispatchPresenceEvent($room);
    }

    public function getPresence(Room $room): Collection
    {
        $members = $room->members()->with('user')->get();

        return $members->map(function (RoomMember $member) use ($room): array {
            return [
                'id' => $member->id,
                'user_id' => $member->user_id,
                'name' => $member->user->name,
                'presence_status' => $member->presence_status,
                'last_seen_at' => $member->last_seen_at->toISOString(),
                'disconnected_at' => $member->disconnected_at?->toISOString(),
                'joined_at' => $member->created_at->toISOString(),
                'is_owner' => $member->user_id === $room->user_id,
            ];
        });
    }

    public function markStaleAsOffline(): int
    {
        $timeout = now()->subSeconds(self::STALE_TIMEOUT_SECONDS);

        $affectedRoomIds = RoomMember::query()
            ->where('presence_status', 'online')
            ->where('last_seen_at', '<', $timeout)
            ->select('room_id')
            ->distinct()
            ->pluck('room_id');

        $updated = RoomMember::query()
            ->where('presence_status', 'online')
            ->where('last_seen_at', '<', $timeout)
            ->update([
                'presence_status' => 'offline',
                'disconnected_at' => now(),
            ]);

        foreach ($affectedRoomIds as $roomId) {
            $room = Room::find($roomId);

            if ($room !== null) {
                $this->dispatchPresenceEvent($room);
            }
        }

        return $updated;
    }

    /**
     * Broadcast the current member roster for a room. Public entry point used by
     * membership mutations that happen outside this service (join/kick/transfer).
     */
    public function broadcastMembers(Room $room): void
    {
        $this->dispatchPresenceEvent($room);
    }

    private function dispatchPresenceEvent(Room $room): void
    {
        $members = $this->getPresence($room);

        broadcast(new MemberPresenceChanged(
            roomId: $room->id,
            members: $members->toArray(),
        ));
    }
}
