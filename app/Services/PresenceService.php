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
                'is_guest' => $member->user->isGuest(),
            ];
        });
    }

    public function markStaleAsOffline(): int
    {
        $timeout = now()->subSeconds(self::STALE_TIMEOUT_SECONDS);

        $staleMembers = RoomMember::query()
            ->where('presence_status', 'online')
            ->where('last_seen_at', '<', $timeout)
            ->with(['room', 'user'])
            ->get()
            ->groupBy('room_id');

        $updated = RoomMember::query()
            ->where('presence_status', 'online')
            ->where('last_seen_at', '<', $timeout)
            ->update([
                'presence_status' => 'offline',
                'disconnected_at' => now(),
            ]);

        foreach ($staleMembers as $members) {
            $room = $members->first()->room;

            if ($room !== null) {
                $this->dispatchPresenceEvent($room);
            }
        }

        return $updated;
    }

    /**
     * Delete guest accounts that can never come back: no online membership,
     * nothing seen within $inactiveHours, and no owned rooms (a guest that
     * received an ownership transfer must never be pruned — rooms.user_id
     * would dangle). Deleting the user cascades memberships, likes and
     * reports; chat messages are nullOnDelete and survive.
     *
     * Runs inside the same presence:timeout cadence as markStaleAsOffline.
     */
    public function pruneStaleGuests(int $inactiveHours = 24): int
    {
        $cutoff = now()->subHours($inactiveHours);

        $staleGuestIds = User::query()
            ->where('is_guest', true)
            ->whereDoesntHave('ownedRooms')
            ->whereDoesntHave('memberships', function ($query): void {
                $query->where('presence_status', 'online');
            })
            ->whereDoesntHave('memberships', function ($query) use ($cutoff): void {
                $query->where('last_seen_at', '>=', $cutoff);
            })
            // Guests that never joined anything have no memberships to judge
            // by — fall back to the account's own freshness.
            ->where('updated_at', '<', $cutoff)
            ->pluck('id');

        $deleted = 0;

        foreach ($staleGuestIds->chunk(500) as $chunk) {
            $deleted += User::whereIn('id', $chunk)->delete();
        }

        return $deleted;
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
