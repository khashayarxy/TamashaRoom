<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcasts synchronously (ShouldBroadcastNow): production drains its
 * database queue only once a minute via cron, and a queued broadcast would
 * delay roster updates and chat join/leave moments by 0–60s.
 */
class MemberPresenceChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $roomId,
        public array $members,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('room.'.$this->roomId),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'members' => $this->members,
        ];
    }

    public function broadcastAs(): string
    {
        return 'member.presence.changed';
    }
}
