<?php

declare(strict_types=1);

namespace App\Actions;

use App\Http\Requests\JoinRoomRequest;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use App\Services\PresenceService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class JoinRoomAction
{
    public function __construct(
        private readonly PresenceService $presence,
    ) {}

    /**
     * Join a room by invite code, creating a guest user if unauthenticated.
     *
     * Returns the Room on success. Throws AuthorizationException (or returns
     * back with errors) when the join is denied.
     */
    public function execute(JoinRoomRequest $request, string $inviteCode): Room
    {
        $room = Room::query()->lockForUpdate()
            ->where('invite_code', $inviteCode)
            ->firstOrFail();

        $authenticatedUser = $request->user();

        if ($authenticatedUser !== null && ($authenticatedUser->id === $room->user_id || $room->members()->where('user_id', $authenticatedUser->id)->exists())) {
            $room->members()->where('user_id', $authenticatedUser->id)->update([
                'presence_status' => 'online',
                'last_seen_at' => now(),
            ]);
            $room->touchActivity();
            $this->presence->broadcastMembers($room);

            return $room;
        }

        $isGuest = $authenticatedUser === null;
        $createdGuest = null;

        $user = $authenticatedUser;

        if ($isGuest) {
            $user = $this->createGuestUser($request->input('guest_name'));
            $createdGuest = $user;
        }

        try {
            Gate::forUser($user)->authorize('join', $room);
        } catch (AuthorizationException $e) {
            if ($createdGuest !== null) {
                $createdGuest->delete();
            }

            throw $e;
        }

        RoomMember::firstOrCreate(
            [
                'room_id' => $room->id,
                'user_id' => $user->id,
            ],
            [
                'last_seen_at' => now(),
                'presence_status' => 'online',
                'joined_at' => now(),
            ]
        );

        $room->touchActivity();

        if ($isGuest) {
            Auth::login($user);
        }

        $this->presence->broadcastMembers($room);

        return $room;
    }

    private function createGuestUser(?string $name): User
    {
        $displayName = trim((string) $name) !== '' ? trim($name) : 'مهمان';

        return User::create([
            'name' => $displayName,
            'email' => 'guest-'.Str::uuid().'@tamasharoom.local',
            'password' => Str::random(32),
            'is_guest' => true,
        ]);
    }
}
