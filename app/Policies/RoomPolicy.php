<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Room;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class RoomPolicy
{
    public function view(User $user, Room $room): bool
    {
        return $user->id === $room->user_id
            || $room->members()->where('user_id', $user->id)->exists();
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

    public function update(User $user, Room $room): bool
    {
        return $user->id === $room->user_id;
    }

    public function delete(User $user, Room $room): bool
    {
        return $user->id === $room->user_id;
    }

    public function kick(User $user, Room $room, User $target): bool
    {
        if ($user->id !== $room->user_id) {
            return false;
        }

        return $target->id !== $room->user_id;
    }

    public function transfer(User $user, Room $room): bool
    {
        return $user->id === $room->user_id;
    }

    public function setVideo(User $user, Room $room): bool
    {
        return $user->id === $room->user_id;
    }

    public function memberAccess(User $user, Room $room): bool
    {
        return $user->id === $room->user_id
            || $room->members()->where('user_id', $user->id)->exists();
    }
}
