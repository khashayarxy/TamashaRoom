<?php

declare(strict_types=1);

namespace App\Models;

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

    protected $appends = [
        'is_owner',
    ];

    protected $hidden = [
        'room',
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

    public function getIsOwnerAttribute(): bool
    {
        return $this->user_id === $this->room?->user_id;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
