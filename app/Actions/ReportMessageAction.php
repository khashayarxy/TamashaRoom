<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\ChatMessage;
use App\Models\MessageReport;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ReportMessageAction
{
    /**
     * Report a chat message. Prevents duplicate reports by the same user.
     */
    public function execute(
        Room $room,
        ChatMessage $message,
        User $reporter,
        ?string $reason = null,
        ?string $details = null,
    ): JsonResponse {
        $existing = MessageReport::where('message_id', $message->id)
            ->where('reporter_id', $reporter->id)
            ->first();

        if ($existing) {
            return response()->json([
                'status' => 'error',
                'message' => 'این پیام قبلاً توسط شما گزارش شده است.',
            ], 422);
        }

        MessageReport::create([
            'room_id' => $room->id,
            'message_id' => $message->id,
            'reporter_id' => $reporter->id,
            'reason' => $reason,
            'details' => $details,
        ]);

        return response()->json([
            'status' => 'ok',
            'message' => 'گزارش پیام ثبت شد.',
        ]);
    }
}
