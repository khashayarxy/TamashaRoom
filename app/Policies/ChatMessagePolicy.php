<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ChatMessagePolicy
{
    public function create(User $user, Room $room): Response
    {
        return $this->memberOrNotFound($user, $room);
    }

    public function viewAny(User $user, Room $room): Response
    {
        return $this->memberOrNotFound($user, $room);
    }

    public function delete(User $user, ChatMessage $message, Room $room): Response
    {
        if ($user->id === $message->user_id) {
            return Response::allow();
        }

        // The room owner may delete any message in their room.
        if ($user->id === $room->user_id) {
            return Response::allow();
        }

        // A room member may see the room but cannot delete others' messages.
        if ($room->members()->where('user_id', $user->id)->exists()) {
            return Response::deny();
        }

        // A stranger must not learn the room (or message) exists.
        return Response::denyAsNotFound();
    }

    private function memberOrNotFound(User $user, Room $room): Response
    {
        return $user->id === $room->user_id
            || $room->members()->where('user_id', $user->id)->exists()
                ? Response::allow()
                : Response::denyAsNotFound();
    }
}
