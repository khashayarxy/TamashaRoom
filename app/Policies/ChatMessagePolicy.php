<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\User;

class ChatMessagePolicy
{
    public function create(User $user, Room $room): bool
    {
        return $user->id === $room->user_id
            || $room->members()->where('user_id', $user->id)->exists();
    }

    public function viewAny(User $user, Room $room): bool
    {
        return $user->id === $room->user_id
            || $room->members()->where('user_id', $user->id)->exists();
    }

    public function delete(User $user, ChatMessage $message): bool
    {
        return $user->id === $message->user_id;
    }
}
