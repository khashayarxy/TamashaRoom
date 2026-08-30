<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageReport extends Model
{
    protected $fillable = [
        'room_id',
        'message_id',
        'reporter_id',
        'reason',
        'details',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(ChatMessage::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }
}
