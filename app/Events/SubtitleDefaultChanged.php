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
 * Broadcasts synchronously (ShouldBroadcastNow): production drains its
 * database queue only once a minute via cron, so a queued broadcast would
 * delay the default-subtitle switch by 0-60s for every other member — the
 * same KI-021 failure mode the playback/presence/chat events already guard
 * against with ShouldBroadcastNow.
 */
class SubtitleDefaultChanged implements ShouldBroadcastNow
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
