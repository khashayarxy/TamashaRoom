<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Guards against guest-identity proliferation (Issue 2): every logged-out
 * join used to mint a brand-new User + RoomMember, so one person rejoining
 * appeared "duplicated" in the roster with a stale offline row.
 *
 * These tests drive the real join route (not the /__test/join-room helper,
 * whose owner-login footgun without force_new: true is a separate concern).
 */
class GuestIdentityTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['email_verified_at' => now()]);

        $this->room = Room::factory()->create([
            'user_id' => $this->owner->id,
            'invite_code' => 'GUESTID01',
            'max_members' => 10,
        ]);
    }

    #[Test]
    public function guest_joining_twice_same_session_yields_one_roster_entry(): void
    {
        $this->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'Dr p'])
            ->assertRedirect(route('rooms.show', $this->room));

        $firstGuestId = User::where('name', 'Dr p')->value('id');
        $this->assertNotNull($firstGuestId);

        // Same browser session (still authenticated as the guest): the
        // member-reuse path must kick in, not a second guest row.
        $this->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'Dr p'])
            ->assertRedirect(route('rooms.show', $this->room));

        $this->assertEquals(1, User::where('name', 'Dr p')->count());
        $this->assertEquals(1, RoomMember::where('room_id', $this->room->id)
            ->where('user_id', $firstGuestId)->count());
    }

    #[Test]
    public function session_guest_is_reused_when_auth_is_lost(): void
    {
        $staleGuest = User::factory()->create([
            'name' => 'Old Name',
            'is_guest' => true,
        ]);

        // Logged out, but the session still carries the minted guest id
        // (auth lost, session survived): reuse it and sync the new name.
        $this->withSession(['guest_user_id' => $staleGuest->id])
            ->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'Dr p'])
            ->assertRedirect(route('rooms.show', $this->room));

        $this->assertEquals(1, User::where('is_guest', true)->count());
        $this->assertEquals('Dr p', $staleGuest->fresh()->name);
        $this->assertDatabaseHas('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $staleGuest->id,
        ]);
        $this->assertAuthenticatedAs($staleGuest);
    }

    #[Test]
    public function guest_joining_different_sessions_yields_separate_entries(): void
    {
        $this->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'Dr p'])
            ->assertRedirect(route('rooms.show', $this->room));

        // A fresh browser session (cookies gone): identity cannot be linked,
        // so a separate guest row is expected — and it must render with the
        // guest badge rather than masquerading as the same member.
        // logout() first: the auth guard singleton would otherwise leak the
        // in-memory user into the next in-test request (real HTTP boots a
        // fresh guard per request and re-resolves from the session).
        $this->app['auth']->logout();
        $this->app['session']->flush();

        $this->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'Dr p'])
            ->assertRedirect(route('rooms.show', $this->room));

        $this->assertEquals(2, User::where('name', 'Dr p')->where('is_guest', true)->count());
        $this->assertEquals(2, RoomMember::where('room_id', $this->room->id)->count());
    }

    #[Test]
    public function stale_guest_pruned_after_24h(): void
    {
        $staleGuest = User::factory()->create(['is_guest' => true, 'updated_at' => now()->subHours(30)]);
        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $staleGuest->id,
            'presence_status' => 'offline',
            'last_seen_at' => now()->subHours(25),
        ]);

        $memberlessGuest = User::factory()->create(['is_guest' => true]);
        $memberlessGuest->forceFill(['updated_at' => now()->subHours(30)])->save();

        $recentGuest = User::factory()->create(['is_guest' => true]);
        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $recentGuest->id,
            'presence_status' => 'offline',
            'last_seen_at' => now()->subHour(),
        ]);

        $onlineGuest = User::factory()->create(['is_guest' => true]);
        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $onlineGuest->id,
            'presence_status' => 'online',
            'last_seen_at' => now()->subHours(30),
        ]);

        $guestOwner = User::factory()->create(['is_guest' => true, 'updated_at' => now()->subHours(30)]);
        $ownedRoom = Room::factory()->create([
            'user_id' => $guestOwner->id,
            'invite_code' => 'GUESTOWN1',
            'max_members' => 10,
        ]);
        RoomMember::create([
            'room_id' => $ownedRoom->id,
            'user_id' => $guestOwner->id,
            'presence_status' => 'offline',
            'last_seen_at' => now()->subHours(30),
        ]);

        $registered = User::factory()->create(['email_verified_at' => now(), 'updated_at' => now()->subHours(30)]);
        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $registered->id,
            'presence_status' => 'offline',
            'last_seen_at' => now()->subHours(25),
        ]);

        $this->artisan('presence:timeout')->assertSuccessful();

        $this->assertDatabaseMissing('users', ['id' => $staleGuest->id]);
        $this->assertDatabaseMissing('users', ['id' => $memberlessGuest->id]);
        $this->assertDatabaseMissing('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $staleGuest->id,
        ]);

        $this->assertDatabaseHas('users', ['id' => $recentGuest->id]);
        $this->assertDatabaseHas('users', ['id' => $onlineGuest->id]);
        $this->assertDatabaseHas('users', ['id' => $guestOwner->id]);
        $this->assertDatabaseHas('users', ['id' => $registered->id]);
    }
}
