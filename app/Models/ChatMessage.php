<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatMessage extends Model
{
    protected $fillable = [
        'room_id',
        'user_id',
        'body',
        'reply_to_id',
    ];

    protected function casts(): array
    {
        return [
            'room_id' => 'integer',
            'user_id' => 'integer',
            'reply_to_id' => 'integer',
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

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_id');
    }

    public function likes(): HasMany
    {
        return $this->hasMany(ChatMessageLike::class, 'message_id');
    }
}
