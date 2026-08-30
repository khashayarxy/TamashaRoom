<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Room;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class RoomPolicy
{
    public function view(User $user, Room $room): Response
    {
        return $this->memberOrNotFound($user, $room);
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function join(User $user, Room $room): Response
    {
        if ($room->isFull()) {
            return Response::deny('این اتاق پر است.');
        }

        if ($room->is_locked) {
            return Response::deny('این اتاق قفل شده است.');
        }

        return $user->id !== $room->user_id
            && ! $room->members()->where('user_id', $user->id)->exists()
                ? Response::allow()
                : Response::deny('شما قبلاً عضو این اتاق هستید.');
    }

    public function update(User $user, Room $room): Response
    {
        return $this->ownerOrDenyForMember($user, $room);
    }

    public function delete(User $user, Room $room): Response
    {
        return $this->ownerOrDenyForMember($user, $room);
    }

    public function kick(User $user, Room $room, User $target): Response
    {
        $owner = $this->ownerOrDenyForMember($user, $room);
        if (! $owner->allowed()) {
            return $owner;
        }

        return $target->id !== $room->user_id
            ? Response::allow()
            : Response::deny();
    }

    public function transfer(User $user, Room $room): Response
    {
        return $this->ownerOrDenyForMember($user, $room);
    }

    public function setVideo(User $user, Room $room): Response
    {
        return $this->ownerOrDenyForMember($user, $room);
    }

    public function memberAccess(User $user, Room $room): Response
    {
        return $this->memberOrNotFound($user, $room);
    }

    /**
     * Room members (and the owner) may proceed; anyone else gets a 404 so the
     * room's existence is not disclosed (see security-rules: unauthorized
     * resources return 404, not 403).
     */
    private function memberOrNotFound(User $user, Room $room): Response
    {
        return $user->id === $room->user_id
            || $room->members()->where('user_id', $user->id)->exists()
                ? Response::allow()
                : Response::denyAsNotFound();
    }

    /**
     * The owner may proceed. A member (who can see the room) is denied with
     * 403 because the action itself is not permitted; a stranger is denied
     * with 404 so the room's existence is not disclosed.
     */
    private function ownerOrDenyForMember(User $user, Room $room): Response
    {
        if ($user->id === $room->user_id) {
            return Response::allow();
        }

        return $room->members()->where('user_id', $user->id)->exists()
            ? Response::deny()
            : Response::denyAsNotFound();
    }
}
