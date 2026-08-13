<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GuestJoinTest extends TestCase
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
            'name' => 'Guest Target Room',
            'invite_code' => 'GUEST01',
            'max_members' => 10,
        ]);
    }

    #[Test]
    public function guest_can_view_join_confirmation_without_login(): void
    {
        $response = $this->get("/rooms/join/{$this->room->invite_code}");

        $response->assertOk();
    }

    #[Test]
    public function guest_can_join_with_only_a_display_name(): void
    {
        $response = $this->from("/rooms/join/{$this->room->invite_code}")
            ->post("/rooms/join/{$this->room->invite_code}", [
                'guest_name' => 'آرش',
            ]);

        $response->assertRedirect(route('rooms.show', $this->room));

        $guest = User::where('name', 'آرش')->first();

        $this->assertNotNull($guest);
        $this->assertTrue($guest->is_guest);
        $this->assertDatabaseHas('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $guest->id,
        ]);

        $this->assertAuthenticatedAs($guest);
    }

    #[Test]
    public function guest_with_blank_name_falls_back_to_default_display_name(): void
    {
        $response = $this->post("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('rooms.show', $this->room));

        $guest = User::where('is_guest', true)->first();

        $this->assertNotNull($guest);
        $this->assertSame('مهمان', $guest->name);
        $this->assertAuthenticatedAs($guest);
    }

    #[Test]
    public function guest_cannot_join_a_full_room(): void
    {
        $this->room->update(['max_members' => 1]);

        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'last_seen_at' => now(),
        ]);

        $response = $this->from('/nonexistent')
            ->post("/rooms/join/{$this->room->invite_code}", [
                'guest_name' => 'آرش',
            ]);

        $response->assertSessionHasErrors('invite_code');

        $this->assertFalse(User::where('is_guest', true)->exists());
    }

    #[Test]
    public function existing_member_reopening_join_confirm_redirects_straight_to_room(): void
    {
        $this->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'آرش']);
        $guest = User::where('name', 'آرش')->firstOrFail();
        $this->assertAuthenticatedAs($guest);

        $response = $this->actingAs($guest)->get("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('rooms.show', $this->room));
    }

    #[Test]
    public function existing_member_submitting_join_post_reenters_room_without_duplicate_insert_crash(): void
    {
        $this->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'آرش']);
        $guest = User::where('name', 'آرش')->firstOrFail();
        $this->assertAuthenticatedAs($guest);

        $response = $this->actingAs($guest)->post("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('rooms.show', $this->room));
    }

    #[Test]
    public function guest_leaves_via_tab_close_and_reopens_invite_link_reenters_room_successfully(): void
    {
        $this->post("/rooms/join/{$this->room->invite_code}", ['guest_name' => 'سامان']);
        $guest = User::where('name', 'سامان')->firstOrFail();
        $this->assertAuthenticatedAs($guest);

        $this->actingAs($guest)->post(route('presence.leave', $this->room))->assertOk();
        $this->assertDatabaseHas('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $guest->id,
            'presence_status' => 'offline',
        ]);

        $reopenConfirm = $this->actingAs($guest)->get("/rooms/join/{$this->room->invite_code}");
        $reopenConfirm->assertRedirect(route('rooms.show', $this->room));

        $reopenJoin = $this->actingAs($guest)->post("/rooms/join/{$this->room->invite_code}");
        $reopenJoin->assertRedirect(route('rooms.show', $this->room));

        $this->assertDatabaseHas('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $guest->id,
            'presence_status' => 'online',
        ]);
        $this->assertSame(1, RoomMember::where('room_id', $this->room->id)->where('user_id', $guest->id)->count());
    }

    #[Test]
    public function guest_cannot_join_a_locked_room(): void
    {
        $this->room->update(['is_locked' => true]);

        $response = $this->post("/rooms/join/{$this->room->invite_code}", [
            'guest_name' => 'آرش',
        ]);

        $response->assertSessionHasErrors('invite_code');

        $this->assertFalse(User::where('is_guest', true)->exists());
        $this->assertFalse(RoomMember::where('room_id', $this->room->id)->exists());
    }

    #[Test]
    public function authenticated_user_joining_is_not_marked_as_guest(): void
    {
        $joiner = User::factory()->create([
            'email_verified_at' => now(),
            'is_guest' => false,
        ]);

        $response = $this->actingAs($joiner)
            ->post("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('rooms.show', $this->room));

        $joiner->refresh();
        $this->assertFalse($joiner->is_guest);
        $this->assertAuthenticatedAs($joiner);
    }

    #[Test]
    public function guest_join_creates_an_is_guest_user_with_a_synthetic_unique_email(): void
    {
        $this->post("/rooms/join/{$this->room->invite_code}", [
            'guest_name' => 'مهمان',
        ]);

        $guest = User::where('is_guest', true)->firstOrFail();

        $this->assertStringStartsWith('guest-', $guest->email);
        $this->assertStringEndsWith('@tamasharoom.local', $guest->email);
        $this->assertNotEquals($this->owner->email, $guest->email);
    }
}
