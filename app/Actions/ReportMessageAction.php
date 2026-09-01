<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\ChatMessage;
use App\Models\MessageReport;
use App\Models\Room;
use App\Models\User;

class ReportMessageAction
{
    /**
     * Report a chat message. Prevents duplicate reports by the same user.
     *
     * @return MessageReport|null null when already reported (duplicate)
     */
    public function execute(
        Room $room,
        ChatMessage $message,
        User $reporter,
        ?string $reason = null,
        ?string $details = null,
    ): ?MessageReport {
        $existing = MessageReport::where('message_id', $message->id)
            ->where('reporter_id', $reporter->id)
            ->first();

        if ($existing) {
            return null;
        }

        return MessageReport::create([
            'room_id' => $room->id,
            'message_id' => $message->id,
            'reporter_id' => $reporter->id,
            'reason' => $reason,
            'details' => $details,
        ]);
    }
}
