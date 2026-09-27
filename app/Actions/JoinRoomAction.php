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
            $user = $this->resolveSessionGuest($request);

            if ($user === null) {
                $user = $this->createGuestUser($request->input('guest_name'));
                $createdGuest = $user;
                $request->session()->put('guest_user_id', $user->id);
            } else {
                $this->syncGuestDisplayName($user, $request->input('guest_name'));
            }
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
        return User::create([
            'name' => $this->normalizeGuestName($name),
            'email' => 'guest-'.Str::uuid().'@tamasharoom.local',
            'password' => Str::random(32),
            'is_guest' => true,
        ]);
    }

    /**
     * One guest identity per browser session: if this session already minted
     * a guest (e.g. auth was lost but the session survived, or a second room
     * is joined logged-out), reuse it instead of minting a duplicate row.
     * Only genuine guest accounts are ever adopted — a tampered session key
     * pointing at a registered user is ignored.
     */
    private function resolveSessionGuest(JoinRoomRequest $request): ?User
    {
        $guestUserId = $request->session()->get('guest_user_id');

        if (! is_numeric($guestUserId)) {
            return null;
        }

        $user = User::whereKey($guestUserId)->first();

        return $user !== null && $user->isGuest() ? $user : null;
    }

    /**
     * Same person, new display name: keep the single session identity and
     * rename it rather than forking a second guest row.
     */
    private function syncGuestDisplayName(User $user, ?string $name): void
    {
        $displayName = $this->normalizeGuestName($name);

        if ($user->name !== $displayName) {
            $user->update(['name' => $displayName]);
        }
    }

    private function normalizeGuestName(?string $name): string
    {
        $trimmed = trim((string) $name);

        return $trimmed !== '' ? $trimmed : 'مهمان';
    }
}
