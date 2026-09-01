<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PlaybackMode;
use App\Services\PresenceService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'invite_code',
        'video_url',
        'playback_mode',
        'is_playing',
        'position_seconds',
        'duration_seconds',
        'playback_rate',
        'state_version',
        'server_timestamp',
        'max_members',
        'last_activity_at',
        'is_locked',
        'active_subtitle_track_id',
    ];

    protected function casts(): array
    {
        return [
            'is_playing' => 'boolean',
            'is_locked' => 'boolean',
            'playback_mode' => PlaybackMode::class,
            'position_seconds' => 'float',
            'duration_seconds' => 'float',
            'playback_rate' => 'float',
            'state_version' => 'integer',
            'server_timestamp' => 'float',
            'last_activity_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(RoomMember::class);
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function subtitleTracks(): HasMany
    {
        return $this->hasMany(SubtitleTrack::class);
    }

    public function activeSubtitleTrack(): BelongsTo
    {
        return $this->belongsTo(SubtitleTrack::class, 'active_subtitle_track_id');
    }

    public static function generateInviteCode(): string
    {
        return Str::random(12);
    }

    /**
     * Whether the system-wide active-room cap has been reached.
     *
     * Single source of truth for the cap comparison. Both the create-request
     * validator and CreateRoomAction (re-checked inside its lock) use this, so
     * the count query and cap threshold live in exactly one place.
     */
    public static function isAtActiveRoomCapacity(): bool
    {
        $activeCount = static::query()
            ->where('last_activity_at', '>', now()->subHours(2))
            ->count();

        return $activeCount >= (int) config('tamasharoom.max_concurrent_rooms', 50);
    }

    /**
     * Whether the room is at capacity, counted over members active within the
     * presence stale window — a concurrent-viewer cap, not an all-time-member
     * cap. Membership rows persist after a member stops visiting (they may
     * return), so counting all-time members would permanently fill rooms with
     * ghosts and block every future join. Concurrent joins racing for the last
     * slot can overshoot the cap by one; that soft edge is accepted.
     */
    public function isFull(): bool
    {
        return $this->members()
            ->where('last_seen_at', '>=', now()->subSeconds(PresenceService::STALE_TIMEOUT_SECONDS))
            ->count() >= $this->max_members;
    }

    public function touchActivity(): void
    {
        $this->update(['last_activity_at' => now()]);
    }

    /**
     * Update the activity timestamp without writing on every poll/heartbeat.
     * Only writes when the last write is older than the given interval.
     */
    public function touchActivityIfStale(int $intervalSeconds = 300): void
    {
        if ($this->last_activity_at !== null
            && $this->last_activity_at->gt(now()->subSeconds($intervalSeconds))) {
            return;
        }

        $this->touchActivity();
    }

    public function updatePlaybackState(array $data): void
    {
        DB::transaction(function () use ($data): void {
            $room = self::query()->lockForUpdate()->findOrFail($this->id);

            $room->update(array_merge($data, [
                'server_timestamp' => microtime(true),
                'state_version' => $room->state_version + 1,
                'last_activity_at' => now(),
            ]));

            $this->refresh();
        });
    }
}
