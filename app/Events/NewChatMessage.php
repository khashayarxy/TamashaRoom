<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcasts synchronously (ShouldBroadcastNow): production drains its
 * database queue only once a minute via cron, so a queued broadcast would
 * always lose the race against the 3s chat poll it complements.
 */
class NewChatMessage implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public ChatMessage $message,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('room.'.$this->message->room_id),
        ];
    }

    public function broadcastWith(): array
    {
        $replyTo = $this->message->relationLoaded('replyTo')
            ? $this->message->replyTo
            : $this->message->replyTo()->with('user:id,name')->first();

        return [
            'id' => $this->message->id,
            'user_id' => $this->message->user_id,
            'body' => $this->message->body,
            'user' => [
                'id' => $this->message->user->id,
                'name' => $this->message->user->name,
            ],
            'created_at' => $this->message->created_at,
            'reply_to_id' => $this->message->reply_to_id,
            'reply_to' => $replyTo === null ? null : [
                'id' => $replyTo->id,
                'body' => $replyTo->body,
                'user' => [
                    'id' => $replyTo->user->id,
                    'name' => $replyTo->user->name,
                ],
            ],
            // A just-sent message has no likes yet; receivers reconcile
            // counts from polls and chat.message.liked broadcasts.
            'likes' => [],
        ];
    }

    public function broadcastAs(): string
    {
        return 'chat.message.new';
    }
}
