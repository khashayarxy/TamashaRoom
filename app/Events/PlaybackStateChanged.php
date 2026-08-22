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
 * database queue only once a minute via cron, and a queued broadcast would
 * delay playback sync for every guest by 0–60s. The Pusher API POST is
 * user-waiting work (~tens of ms) and belongs in the request.
 */
class PlaybackStateChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Room $room,
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
            'is_playing' => $this->room->is_playing,
            'position_seconds' => $this->room->position_seconds,
            'duration_seconds' => $this->room->duration_seconds,
            'playback_rate' => $this->room->playback_rate,
            'video_url' => $this->room->video_url,
            'playback_mode' => $this->room->playback_mode?->value ?? 'proxy',
            'state_version' => $this->room->state_version,
            'server_timestamp' => $this->room->server_timestamp,
            'user_id' => $this->userId,
            'updated_at' => $this->room->updated_at->toISOString(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'playback.state.changed';
    }
}
