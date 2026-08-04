<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Events\NewChatMessage;
use App\Models\ChatMessage;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function index(Request $request, Room $room): JsonResponse
    {
        $this->authorize('viewAny', [ChatMessage::class, $room]);

        $messages = ChatMessage::where('room_id', $room->id)
            ->with('user:id,name')
            ->latest()
            ->limit(50)
            ->get()
            ->reverse()
            ->values();

        return response()->json($messages);
    }

    public function store(Request $request, Room $room): JsonResponse
    {
        $this->authorize('create', [ChatMessage::class, $room]);

        $validated = $request->validate([
            'body' => 'required|string|max:500',
        ]);

        $message = ChatMessage::create([
            'room_id' => $room->id,
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
        ]);

        $room->touchActivityIfStale();

        $message->load('user:id,name');

        broadcast(new NewChatMessage($message))->toOthers();

        return response()->json($message, 201);
    }

    public function destroy(Request $request, Room $room, ChatMessage $message): JsonResponse
    {
        // Scope the delete to the {room} route parameter so a message id from
        // another room can never be targeted here (matches SubtitleController).
        $message = $room->chatMessages()->whereKey($message->id)->firstOrFail();

        $this->authorize('delete', [$message, $room]);

        $message->delete();

        return response()->json(['status' => 'ok']);
    }
}
