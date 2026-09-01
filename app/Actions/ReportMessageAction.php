<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\AuditLog;
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

        $report = MessageReport::create([
            'room_id' => $room->id,
            'message_id' => $message->id,
            'reporter_id' => $reporter->id,
            'reason' => $reason,
            'details' => $details,
        ]);

        AuditLog::create([
            'user_id' => $reporter->id,
            'action' => 'message.reported',
            'auditable_type' => ChatMessage::class,
            'auditable_id' => $message->id,
            'context' => [
                'room_id' => $room->id,
                'reason' => $reason,
            ],
        ]);

        return $report;
    }
}
