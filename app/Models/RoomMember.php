<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomMember extends Model
{
    protected $fillable = [
        'room_id',
        'user_id',
        'last_seen_at',
        'presence_status',
        'heartbeat_version',
        'joined_at',
        'disconnected_at',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'joined_at' => 'datetime',
            'disconnected_at' => 'datetime',
            'heartbeat_version' => 'integer',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeOnline(Builder $query): Builder
    {
        return $query->where('presence_status', 'online');
    }

    public function scopeOffline(Builder $query): Builder
    {
        return $query->where('presence_status', 'offline');
    }

    public function scopeStale(Builder $query): Builder
    {
        return $query->where('presence_status', 'online')
            ->where('last_seen_at', '<', now()->subSeconds(90));
    }

    public function isOnline(): bool
    {
        return $this->presence_status === 'online';
    }
}
