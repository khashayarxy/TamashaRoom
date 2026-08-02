<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\NullStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CreateRoomAction
{
    /**
     * Create a room the authenticated user owns, respecting the system-wide
     * active-room cap under a cross-process lock.
     *
     * The cap is re-checked inside the lock (not just in the Form Request) so
     * two concurrent creates racing for the final slot cannot both succeed.
     * Throws ValidationException with a user-facing message when the server is
     * busy or at capacity so the Inertia form shows the error on `name`.
     */
    public function execute(User $user, string $name, ?int $maxMembers = null): Room
    {
        $cacheStore = Cache::getStore();

        if (app()->isProduction()
            && ($cacheStore instanceof ArrayStore || $cacheStore instanceof NullStore)) {
            Log::critical(
                'Room cap lock is not cross-process safe with the configured cache store.',
                ['store' => $cacheStore::class],
            );

            throw ValidationException::withMessages([
                'name' => 'سرور مشغول است. لطفاً کمی بعد دوباره تلاش کنید.',
            ]);
        }

        $lock = Cache::lock('room-cap', 10);

        if (! $lock->get()) {
            throw ValidationException::withMessages([
                'name' => 'سرور مشغول است. لطفاً کمی بعد دوباره تلاش کنید.',
            ]);
        }

        try {
            if (Room::isAtActiveRoomCapacity()) {
                throw ValidationException::withMessages([
                    'name' => 'سرور در حال حاضر ظرفیت کامل دارد. لطفاً بعداً تلاش کنید.',
                ]);
            }

            $room = new Room([
                'name' => $name,
                'invite_code' => Room::generateInviteCode(),
                'max_members' => $maxMembers ?? 10,
                'last_activity_at' => now(),
            ]);

            $room->user_id = $user->id;
            $room->save();

            RoomMember::create([
                'room_id' => $room->id,
                'user_id' => $user->id,
                'last_seen_at' => now(),
                'presence_status' => 'online',
                'joined_at' => now(),
            ]);

            return $room;
        } finally {
            $lock->release();
        }
    }
}
