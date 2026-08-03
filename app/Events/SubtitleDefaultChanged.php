<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Room;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SubtitleDefaultChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Room $room,
        public ?int $defaultTrackId,
        public int $userId,
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
            'default_track_id' => $this->defaultTrackId,
            'user_id' => $this->userId,
        ];
    }

    public function broadcastAs(): string
    {
        return 'subtitle.default.changed';
    }
}
