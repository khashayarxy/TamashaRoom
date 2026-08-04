<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PresenceTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $member;

    private User $stranger;

    private Room $room;

    private RoomMember $ownerMember;

    private RoomMember $memberMember;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['email_verified_at' => now()]);
        $this->member = User::factory()->create(['email_verified_at' => now()]);
        $this->stranger = User::factory()->create(['email_verified_at' => now()]);

        $this->room = Room::factory()->create([
            'user_id' => $this->owner->id,
            'video_url' => 'https://example.com/video.mp4',
        ]);

        $this->ownerMember = RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->owner->id,
            'last_seen_at' => now(),
            'presence_status' => 'online',
            'heartbeat_version' => 0,
            'joined_at' => now(),
        ]);

        $this->memberMember = RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now(),
            'presence_status' => 'online',
            'heartbeat_version' => 0,
            'joined_at' => now(),
        ]);
    }

    #[Test]
    public function member_can_send_heartbeat(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/heartbeat");

        $response->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->memberMember->refresh();
        $this->assertEquals('online', $this->memberMember->presence_status);
        $this->assertGreaterThan(0, $this->memberMember->heartbeat_version);
    }

    #[Test]
    public function heartbeat_increments_version(): void
    {
        $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/heartbeat");
        $v1 = $this->memberMember->fresh()->heartbeat_version;

        $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/heartbeat");
        $v2 = $this->memberMember->fresh()->heartbeat_version;

        $this->assertEquals($v1 + 1, $v2);
    }

    #[Test]
    public function stranger_cannot_send_heartbeat(): void
    {
        $response = $this->actingAs($this->stranger)
            ->postJson("/presence/{$this->room->id}/heartbeat");

        $response->assertNotFound();
    }

    #[Test]
    public function member_can_leave(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/leave");

        $response->assertOk();

        $this->memberMember->refresh();
        $this->assertEquals('offline', $this->memberMember->presence_status);
        $this->assertNotNull($this->memberMember->disconnected_at);
    }

    #[Test]
    public function leave_is_idempotent(): void
    {
        $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/leave");

        $response = $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/leave");

        $response->assertOk();
    }

    #[Test]
    public function leave_beacon_requires_valid_csrf_token_in_body(): void
    {
        // PreventRequestForgery short-circuits while running unit tests, so
        // flip the env to force real CSRF verification for these requests.
        $this->app['env'] = 'local';

        $this->actingAs($this->member);
        $this->withSession(['_token' => 'beacon-csrf-token']);

        // A beacon carrying no token is rejected with 419 (the original buggy
        // implementation relied on Sec-Fetch-Site instead of a real token).
        $this->post("/presence/{$this->room->id}/leave")
            ->assertStatus(419);

        $this->memberMember->refresh();
        $this->assertEquals('online', $this->memberMember->presence_status);

        // The leave beacon carries `_token` in its multipart FormData body,
        // which the middleware reads via `$request->input('_token')` — the
        // same parsing path as this form submission. It passes CSRF and the
        // member is marked offline.
        $this->post("/presence/{$this->room->id}/leave", [
            '_token' => 'beacon-csrf-token',
        ])
            ->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->memberMember->refresh();
        $this->assertEquals('offline', $this->memberMember->presence_status);
    }

    #[Test]
    public function owner_can_view_presence_list(): void
    {
        $response = $this->actingAs($this->owner)
            ->getJson("/presence/{$this->room->id}");

        $response->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment(['user_id' => $this->owner->id, 'presence_status' => 'online'])
            ->assertJsonFragment(['user_id' => $this->member->id, 'presence_status' => 'online']);
    }

    #[Test]
    public function member_can_view_presence_list(): void
    {
        $response = $this->actingAs($this->member)
            ->getJson("/presence/{$this->room->id}");

        $response->assertOk()
            ->assertJsonCount(2);
    }

    #[Test]
    public function stranger_cannot_view_presence_list(): void
    {
        $response = $this->actingAs($this->stranger)
            ->getJson("/presence/{$this->room->id}");

        $response->assertNotFound();
    }

    #[Test]
    public function presence_list_shows_owner_flag(): void
    {
        $response = $this->actingAs($this->owner)
            ->getJson("/presence/{$this->room->id}");

        $response->assertOk();

        $ownerEntry = collect($response->json())->firstWhere('user_id', $this->owner->id);
        $this->assertTrue($ownerEntry['is_owner']);

        $memberEntry = collect($response->json())->firstWhere('user_id', $this->member->id);
        $this->assertFalse($memberEntry['is_owner']);
    }

    #[Test]
    public function heartbeat_resets_offline_member_to_online(): void
    {
        $this->memberMember->update([
            'presence_status' => 'offline',
            'disconnected_at' => now(),
        ]);

        $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/heartbeat");

        $this->memberMember->refresh();
        $this->assertEquals('online', $this->memberMember->presence_status);
        $this->assertNotNull($this->memberMember->disconnected_at);
    }

    #[Test]
    public function presence_list_reflects_offline_status_after_leave(): void
    {
        $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/leave");

        $response = $this->actingAs($this->owner)
            ->getJson("/presence/{$this->room->id}");

        $memberEntry = collect($response->json())->firstWhere('user_id', $this->member->id);
        $this->assertEquals('offline', $memberEntry['presence_status']);
        $this->assertNotNull($memberEntry['disconnected_at']);
    }

    #[Test]
    public function heartbeat_returns_version_in_response(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/presence/{$this->room->id}/heartbeat");

        $response->assertJsonStructure([
            'status',
            'heartbeat_version',
        ]);
    }
}
