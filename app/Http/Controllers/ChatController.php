<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\ReportMessageAction;
use App\Events\MessageLiked;
use App\Events\NewChatMessage;
use App\Models\AuditLog;
use App\Models\ChatMessage;
use App\Models\ChatMessageLike;
use App\Models\Room;
use App\Services\ContentModerator;
use App\Traits\HasFeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    use HasFeatureFlags;

    public function index(Request $request, Room $room): JsonResponse
    {
        $this->authorize('viewAny', [ChatMessage::class, $room]);

        $messages = ChatMessage::where('room_id', $room->id)
            ->with(['user:id,name', 'replyTo.user:id,name', 'likes.user:id,name'])
            ->latest()
            ->limit(50)
            ->get()
            ->reverse()
            ->values();

        return response()->json($messages);
    }

    public function store(Request $request, Room $room, ContentModerator $moderator): JsonResponse
    {
        $this->authorize('create', [ChatMessage::class, $room]);

        $validated = $request->validate([
            'body' => 'required|string|max:500',
            'reply_to_id' => ['nullable', 'integer'],
        ]);

        if ($this->featureEnabled('chat_moderation') && $moderator->containsBlockedContent($validated['body'])) {
            return response()->json([
                'message' => 'پیام شما حاوی کلمات نامناسب است.',
                'errors' => ['body' => ['پیام شما حاوی کلمات نامناسب است.']],
            ], 422);
        }

        // A reply target must exist in THIS room. Mirror destroy's scoping:
        // cross-room references 404 (no existence leak), fully-gone ids 422.
        $replyToId = $validated['reply_to_id'] ?? null;
        if ($replyToId !== null) {
            $inRoom = $room->chatMessages()->whereKey($replyToId)->exists();
            if (! $inRoom) {
                if (ChatMessage::whereKey($replyToId)->exists()) {
                    abort(404);
                }

                return response()->json([
                    'message' => 'پیام مورد نظر یافت نشد.',
                    'errors' => ['reply_to_id' => ['پیام مورد نظر یافت نشد.']],
                ], 422);
            }
        }

        $message = ChatMessage::create([
            'room_id' => $room->id,
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
            'reply_to_id' => $replyToId,
        ]);

        $room->touchActivityIfStale();

        $message->load(['user:id,name', 'replyTo.user:id,name', 'likes.user:id,name']);

        broadcast(new NewChatMessage($message))->toOthers();

        return response()->json($message, 201);
    }

    public function destroy(Request $request, Room $room, ChatMessage $message): JsonResponse
    {
        // Idempotent delete: if already deleted in this room, return success silently.
        // For cross-room requests, preserve 404 to avoid leaking existence.
        $existing = $room->chatMessages()->whereKey($message->id)->first();

        if ($existing === null) {
            if (ChatMessage::whereKey($message->id)->exists()) {
                abort(404);
            }

            return response()->json(['status' => 'ok', 'already_deleted' => true]);
        }

        $this->authorize('delete', [$existing, $room]);

        $existing->delete();

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'message.deleted',
            'auditable_type' => ChatMessage::class,
            'auditable_id' => $existing->id,
            'context' => [
                'ip' => $request->ip(),
                'room_id' => $room->id,
            ],
        ]);

        return response()->json(['status' => 'ok']);
    }

    public function toggleLike(Request $request, Room $room, ChatMessage $message): JsonResponse
    {
        $this->authorize('toggleLike', [ChatMessage::class, $room]);

        // Scope the message to this room (same pattern as destroy/report):
        // cross-room references 404 to avoid leaking existence.
        $existing = $room->chatMessages()->whereKey($message->id)->first();

        if ($existing === null) {
            abort(404);
        }

        $like = ChatMessageLike::where('message_id', $existing->id)
            ->where('user_id', $request->user()->id)
            ->first();

        if ($like !== null) {
            $like->delete();
            $liked = false;
        } else {
            ChatMessageLike::create([
                'message_id' => $existing->id,
                'user_id' => $request->user()->id,
            ]);
            $liked = true;
        }

        $likes = ChatMessageLike::where('message_id', $existing->id)
            ->with('user:id,name')
            ->get()
            ->map(fn (ChatMessageLike $l) => [
                'user_id' => $l->user_id,
                'user' => ['id' => $l->user->id, 'name' => $l->user->name],
            ])
            ->values()
            ->all();

        broadcast(new MessageLiked($room, $existing->id, $likes))->toOthers();

        return response()->json([
            'status' => 'ok',
            'liked' => $liked,
            'likes' => $likes,
        ]);
    }

    public function report(
        Request $request,
        Room $room,
        ChatMessage $message,
        ReportMessageAction $action,
    ): JsonResponse {
        $this->authorize('viewAny', [ChatMessage::class, $room]);

        $message = $room->chatMessages()->whereKey($message->id)->firstOrFail();

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:100'],
            'details' => ['nullable', 'string', 'max:1000'],
        ]);

        $report = $action->execute(
            $room,
            $message,
            $request->user(),
            $validated['reason'] ?? null,
            $validated['details'] ?? null,
        );

        if ($report === null) {
            return response()->json([
                'status' => 'error',
                'message' => 'این پیام قبلاً توسط شما گزارش شده است.',
            ], 422);
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'گزارش پیام ثبت شد.',
        ]);
    }
}
