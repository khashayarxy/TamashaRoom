<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
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
            ->getJson("/rooms/join/{$this->room->invite_code}");

        $response->assertForbidden();
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
            ->get("/rooms/join/{$fullRoom->invite_code}");

        $response->assertForbidden();
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
            ->get("/rooms/join/{$tightRoom->invite_code}");

        $response->assertForbidden();
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
}
