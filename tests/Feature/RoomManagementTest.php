<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use App\Services\PresenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RoomManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $member;

    private User $stranger;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['email_verified_at' => now()]);
        $this->member = User::factory()->create(['email_verified_at' => now()]);
        $this->stranger = User::factory()->create(['email_verified_at' => now()]);

        $this->room = Room::factory()->create([
            'user_id' => $this->owner->id,
            'name' => 'Test Room',
            'invite_code' => 'ABC123',
            'max_members' => 10,
        ]);

        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now(),
        ]);
    }

    #[Test]
    public function owner_can_rename_room(): void
    {
        $response = $this->actingAs($this->owner)
            ->patchJson("/rooms/{$this->room->id}", [
                'name' => 'Updated Room Name',
            ]);

        $response->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->room->refresh();
        $this->assertEquals('Updated Room Name', $this->room->name);
    }

    #[Test]
    public function member_cannot_rename_room(): void
    {
        $response = $this->actingAs($this->member)
            ->patchJson("/rooms/{$this->room->id}", [
                'name' => 'Hacked Name',
            ]);

        $response->assertForbidden();

        $this->room->refresh();
        $this->assertEquals('Test Room', $this->room->name);
    }

    #[Test]
    public function owner_can_regenerate_invite_code(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/regenerate-invite");

        $response->assertOk()
            ->assertJsonStructure(['status', 'invite_code']);

        $this->assertNotEquals('ABC123', $response->json('invite_code'));
        $this->assertEquals(12, strlen($response->json('invite_code')));
    }

    #[Test]
    public function member_cannot_regenerate_invite_code(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/regenerate-invite");

        $response->assertForbidden();
    }

    #[Test]
    public function owner_can_toggle_lock(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/toggle-lock");

        $response->assertOk()
            ->assertJson(['is_locked' => true]);

        $this->room->refresh();
        $this->assertTrue($this->room->is_locked);
    }

    #[Test]
    public function owner_can_toggle_lock_on_and_off(): void
    {
        $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/toggle-lock");

        $this->room->refresh();
        $this->assertTrue($this->room->is_locked);

        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/toggle-lock");

        $response->assertJson(['is_locked' => false]);

        $this->room->refresh();
        $this->assertFalse($this->room->is_locked);
    }

    #[Test]
    public function member_cannot_toggle_lock(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/toggle-lock");

        $response->assertForbidden();
    }

    #[Test]
    public function locked_room_prevents_new_members_from_joining(): void
    {
        $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/toggle-lock");

        $response = $this->actingAs($this->stranger)
            ->from(route('dashboard'))
            ->post("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHasErrors('invite_code');
    }

    #[Test]
    public function owner_can_kick_member(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/kick/{$this->member->id}");

        $response->assertOk();

        $this->assertDatabaseMissing('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
        ]);
    }

    #[Test]
    public function owner_cannot_kick_themselves(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/kick/{$this->owner->id}");

        $response->assertForbidden();
    }

    #[Test]
    public function member_cannot_kick_others(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/kick/{$this->owner->id}");

        $response->assertForbidden();
    }

    #[Test]
    public function owner_can_transfer_ownership(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/transfer/{$this->member->id}");

        $response->assertOk();

        $this->room->refresh();
        $this->assertEquals($this->member->id, $this->room->user_id);
    }

    #[Test]
    public function member_cannot_transfer_ownership(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/transfer/{$this->owner->id}");

        $response->assertForbidden();

        $this->room->refresh();
        $this->assertEquals($this->owner->id, $this->room->user_id);
    }

    #[Test]
    public function owner_cannot_transfer_to_non_member(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/transfer/{$this->stranger->id}");

        $response->assertNotFound();
    }

    #[Test]
    public function locked_room_still_allows_existing_members(): void
    {
        $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/toggle-lock");

        $response = $this->actingAs($this->member)
            ->getJson("/playback/{$this->room->id}/state");

        $response->assertOk();
    }

    // ─── Room Cap Enforcement ──────────────────────────────

    #[Test]
    public function full_room_rejects_new_members(): void
    {
        $fullRoom = Room::factory()->create([
            'user_id' => $this->owner->id,
            'name' => 'Full Room',
            'invite_code' => 'FULL123',
            'max_members' => 1,
            'is_locked' => false,
        ]);

        RoomMember::create([
            'room_id' => $fullRoom->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now(),
        ]);

        $response = $this->actingAs($this->stranger)
            ->from(route('dashboard'))
            ->post("/rooms/join/{$fullRoom->invite_code}");

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHasErrors('invite_code');
    }

    #[Test]
    public function owner_cannot_exceed_system_room_cap(): void
    {
        config(['tamasharoom.max_concurrent_rooms' => Room::count() + 1]);

        $this->actingAs($this->owner)
            ->post('/rooms', ['name' => 'First Room']);

        $response = $this->actingAs($this->owner)
            ->post('/rooms', ['name' => 'Second Room']);

        $response->assertSessionHasErrors('name');
    }

    #[Test]
    public function room_cap_race_is_prevented_by_lock(): void
    {
        config(['tamasharoom.max_concurrent_rooms' => Room::count() + 1]);

        $lock = Cache::lock('room-cap', 10);
        $lock->get();

        try {
            $response = $this->actingAs($this->owner)
                ->post('/rooms', ['name' => 'Second Room']);

            $response->assertSessionHasErrors('name');

            $this->assertSame(1, Room::where('user_id', $this->owner->id)->count());
        } finally {
            $lock->release();
        }
    }

    #[Test]
    public function room_cap_lock_is_cross_process_safe_with_database_cache_store(): void
    {
        $originalDefault = config('cache.default');
        config(['cache.default' => 'database']);
        Cache::purge('database');

        try {
            config(['tamasharoom.max_concurrent_rooms' => Room::count() + 1]);

            $lock = Cache::lock('room-cap', 10);
            $this->assertTrue($lock->get());

            try {
                $response = $this->actingAs($this->owner)
                    ->post('/rooms', ['name' => 'Second Room']);

                $response->assertSessionHasErrors('name');

                $this->assertSame(1, Room::where('user_id', $this->owner->id)->count());
            } finally {
                $lock->release();
            }
        } finally {
            config(['cache.default' => $originalDefault]);
            Cache::purge('database');
        }
    }

    #[Test]
    public function room_cap_counts_only_recently_active_rooms(): void
    {
        config(['tamasharoom.max_concurrent_rooms' => 3]);

        $this->assertFalse(Room::isAtActiveRoomCapacity());

        Room::factory()->create([
            'user_id' => $this->owner->id,
            'last_activity_at' => now()->subHours(3),
        ]);
        Room::factory()->create([
            'user_id' => $this->owner->id,
            'last_activity_at' => now()->subDays(1),
        ]);

        $this->assertFalse(Room::isAtActiveRoomCapacity());

        Room::factory()->create([
            'user_id' => $this->owner->id,
            'last_activity_at' => now()->subMinutes(30),
        ]);

        $this->assertFalse(Room::isAtActiveRoomCapacity());

        Room::factory()->create([
            'user_id' => $this->owner->id,
            'last_activity_at' => now()->subMinutes(1),
        ]);

        $this->assertTrue(Room::isAtActiveRoomCapacity());
    }

    #[Test]
    public function store_creates_room_with_owner_as_online_member(): void
    {
        $response = $this->actingAs($this->owner)
            ->post('/rooms', ['name' => 'Fresh Room']);

        $response->assertRedirect(route('rooms.show', Room::where('name', 'Fresh Room')->firstOrFail()));

        $room = Room::where('name', 'Fresh Room')->firstOrFail();

        $this->assertSame($this->owner->id, $room->user_id);
        $this->assertSame(10, $room->max_members);
        $this->assertDatabaseHas('room_members', [
            'room_id' => $room->id,
            'user_id' => $this->owner->id,
            'presence_status' => 'online',
        ]);
    }

    // ─── Activity Tracking ────────────────────────────────

    #[Test]
    public function join_updates_room_last_activity(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00'));

        $this->room->update(['last_activity_at' => now()->subMinutes(10)]);

        $joiner = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($joiner)
            ->post("/rooms/join/{$this->room->invite_code}");

        $this->room->refresh();

        $this->assertTrue($this->room->last_activity_at->gt(Carbon::parse('2026-06-01 11:59:00')));
    }

    #[Test]
    public function chat_message_updates_room_last_activity(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00'));

        $this->room->update(['last_activity_at' => now()->subMinutes(10)]);

        $this->actingAs($this->member)
            ->post("/chat/{$this->room->id}/messages", [
                'body' => 'Hello from activity test',
            ]);

        $this->room->refresh();

        $this->assertTrue($this->room->last_activity_at->gt(Carbon::parse('2026-06-01 11:59:00')));
    }

    #[Test]
    public function heartbeat_updates_room_last_activity(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00'));

        $this->room->update(['last_activity_at' => now()->subMinutes(10)]);

        $this->actingAs($this->member)
            ->post("/presence/{$this->room->id}/heartbeat");

        $this->room->refresh();

        $this->assertTrue($this->room->last_activity_at->gt(Carbon::parse('2026-06-01 11:59:00')));
    }

    // ─── Data Cleanup ─────────────────────────────────────

    #[Test]
    public function deleting_room_removes_chat_messages(): void
    {
        ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'body' => 'Test message',
        ]);

        $this->actingAs($this->owner)
            ->delete("/rooms/{$this->room->id}");

        $this->assertDatabaseMissing('chat_messages', ['room_id' => $this->room->id]);
    }

    #[Test]
    public function deleting_room_removes_members(): void
    {
        $this->actingAs($this->owner)
            ->delete("/rooms/{$this->room->id}");

        $this->assertDatabaseMissing('room_members', ['room_id' => $this->room->id]);
    }

    #[Test]
    public function freshly_created_room_survives_prune(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00'));

        Artisan::call('rooms:prune-inactive', ['--days' => 1]);

        $this->assertDatabaseHas('rooms', ['id' => $this->room->id]);
    }

    #[Test]
    public function join_race_guard_prevents_overfilling_room(): void
    {
        $tightRoom = Room::factory()->create([
            'user_id' => $this->owner->id,
            'name' => 'Tight Room',
            'invite_code' => 'TIGHT01',
            'max_members' => 1,
            'is_locked' => false,
        ]);

        $firstJoiner = User::factory()->create(['email_verified_at' => now()]);

        RoomMember::create([
            'room_id' => $tightRoom->id,
            'user_id' => $firstJoiner->id,
            'last_seen_at' => now(),
        ]);

        $secondJoiner = User::factory()->create(['email_verified_at' => now()]);

        $response = $this->actingAs($secondJoiner)
            ->from(route('dashboard'))
            ->post("/rooms/join/{$tightRoom->invite_code}");

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHasErrors('invite_code');
    }

    #[Test]
    public function prune_inactive_command_removes_orphaned_data(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-01 12:00:00'));

        $oldRoom = Room::factory()->create([
            'user_id' => $this->owner->id,
            'name' => 'Stale Room',
            'invite_code' => 'STALE123',
            'last_activity_at' => now()->subDays(30),
        ]);

        RoomMember::create([
            'room_id' => $oldRoom->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now()->subDays(30),
        ]);

        ChatMessage::create([
            'room_id' => $oldRoom->id,
            'user_id' => $this->member->id,
            'body' => 'Old message',
        ]);

        Artisan::call('rooms:prune-inactive', ['--days' => 14]);

        $this->assertDatabaseMissing('rooms', ['id' => $oldRoom->id]);
        $this->assertDatabaseMissing('room_members', ['room_id' => $oldRoom->id]);
        $this->assertDatabaseMissing('chat_messages', ['room_id' => $oldRoom->id]);
    }

    #[Test]
    public function members_endpoint_does_not_expose_user_email(): void
    {
        $response = $this->actingAs($this->member)
            ->getJson(route('rooms.members', $this->room));

        $response->assertOk();

        $members = $response->json();

        $this->assertNotEmpty($members);

        $this->assertArrayNotHasKey('email', $members[0]['user']);

        $user = $members[0]['user'];
        $this->assertArrayHasKey('id', $user);
        $this->assertArrayHasKey('name', $user);
        $this->assertArrayNotHasKey('created_at', $user);
    }

    #[Test]
    public function room_show_props_do_not_expose_member_emails(): void
    {
        ChatMessage::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'body' => 'Hello',
        ]);

        $response = $this->actingAs($this->member)->get(route('rooms.show', $this->room));

        $response->assertOk();
        $response->assertDontSee($this->owner->email);
    }

    #[Test]
    public function get_join_shows_confirmation_without_creating_membership(): void
    {
        $joiner = User::factory()->create(['email_verified_at' => now()]);

        $response = $this->actingAs($joiner)
            ->get("/rooms/join/{$this->room->invite_code}");

        $response->assertOk();
        $response->assertSee($this->room->name);

        $this->assertDatabaseMissing('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $joiner->id,
        ]);
    }

    #[Test]
    public function post_join_creates_membership(): void
    {
        $joiner = User::factory()->create(['email_verified_at' => now()]);

        $response = $this->actingAs($joiner)
            ->post("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('rooms.show', $this->room));

        $this->assertDatabaseHas('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $joiner->id,
        ]);
    }

    #[Test]
    public function initial_room_load_returns_only_the_latest_fifty_chat_messages(): void
    {
        for ($i = 1; $i <= 60; $i++) {
            $message = ChatMessage::create([
                'room_id' => $this->room->id,
                'user_id' => $this->owner->id,
                'body' => "message {$i}",
            ]);
            $message->created_at = now()->addSeconds($i);
            $message->save();
        }

        $response = $this->actingAs($this->member)
            ->get("/rooms/{$this->room->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Rooms/Show')
            ->has('room.chat_messages', 50)
            ->where('room.chat_messages.0.body', 'message 11')
            ->where('room.chat_messages.49.body', 'message 60'));
    }

    #[Test]
    public function initial_room_load_keeps_chat_messages_in_chronological_order(): void
    {
        for ($i = 1; $i <= 55; $i++) {
            $message = ChatMessage::create([
                'room_id' => $this->room->id,
                'user_id' => $this->owner->id,
                'body' => "message {$i}",
            ]);
            $message->created_at = now()->addSeconds($i);
            $message->save();
        }

        $response = $this->actingAs($this->member)
            ->get("/rooms/{$this->room->id}");

        $response->assertInertia(fn ($page) => $page
            ->component('Rooms/Show')
            ->has('room.chat_messages', 50)
            ->where('room.chat_messages.0.body', 'message 6')
            ->where('room.chat_messages.49.body', 'message 55'));
    }

    #[Test]
    public function member_can_leave_room_removing_their_membership(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/leave");

        $response->assertOk()->assertJson(['status' => 'ok']);

        $this->assertDatabaseMissing('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
        ]);
    }

    #[Test]
    public function owner_cannot_leave_own_room(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/rooms/{$this->room->id}/leave");

        $response->assertForbidden()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseHas('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
        ]);
    }

    #[Test]
    public function stranger_cannot_leave_room(): void
    {
        $this->actingAs($this->stranger)
            ->postJson("/rooms/{$this->room->id}/leave")
            ->assertNotFound();
    }

    #[Test]
    public function member_can_rejoin_after_leaving(): void
    {
        $this->actingAs($this->member)
            ->postJson("/rooms/{$this->room->id}/leave")
            ->assertOk();

        $response = $this->actingAs($this->member)
            ->from(route('dashboard'))
            ->post("/rooms/join/{$this->room->invite_code}");

        $response->assertRedirect(route('rooms.show', $this->room));
        $this->assertDatabaseHas('room_members', [
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
        ]);
    }

    #[Test]
    public function room_capacity_counts_only_members_active_within_the_stale_window(): void
    {
        $cappedRoom = Room::factory()->create([
            'user_id' => $this->owner->id,
            'name' => 'Capped Room',
            'max_members' => 2,
            'is_locked' => false,
        ]);

        RoomMember::create([
            'room_id' => $cappedRoom->id,
            'user_id' => $this->owner->id,
            'last_seen_at' => now(),
        ]);

        // A long-gone member keeps their membership row but must not consume
        // a capacity slot — otherwise rooms fill with ghosts forever.
        RoomMember::create([
            'room_id' => $cappedRoom->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now()->subSeconds(PresenceService::STALE_TIMEOUT_SECONDS + 60),
        ]);

        $this->assertFalse($cappedRoom->isFull());

        $joiner = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($joiner)
            ->from(route('dashboard'))
            ->post("/rooms/join/{$cappedRoom->invite_code}")
            ->assertRedirect(route('rooms.show', $cappedRoom));

        $this->assertTrue($cappedRoom->fresh()->isFull());
    }
}
