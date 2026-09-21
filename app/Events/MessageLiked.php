<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Room;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcasts synchronously (ShouldBroadcastNow): same rationale as
 * NewChatMessage — the database queue drains once a minute via cron, so a
 * queued broadcast would always lose the race against chat polling.
 */
class MessageLiked implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<int, array{user_id: int, user: array{id: int, name: string}}>  $likes
     */
    public function __construct(
        public Room $room,
        public int $messageId,
        public array $likes,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('room.'.$this->room->id),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'message_id' => $this->messageId,
            'likes' => $this->likes,
        ];
    }

    public function broadcastAs(): string
    {
        return 'chat.message.liked';
    }
}
