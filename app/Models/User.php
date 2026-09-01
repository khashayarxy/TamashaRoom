<?php

declare(strict_types=1);

namespace App\Models;

use App\Notifications\VerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail as MustVerifyEmailContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable implements MustVerifyEmailContract
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'is_guest',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function ownedRooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(RoomMember::class);
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function isGuest(): bool
    {
        return (bool) $this->is_guest;
    }

    /**
     * Guest accounts use a synthetic email address and are never required to
     * verify it — only real registered accounts must verify.
     */
    public function hasVerifiedEmail(): bool
    {
        return $this->isGuest() || parent::hasVerifiedEmail();
    }

    /**
     * Send the Persian email verification notification.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmail);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_guest' => 'boolean',
        ];
    }
}
