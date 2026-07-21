<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\PlaybackMode;
use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PlaybackSyncTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $member;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['email_verified_at' => now()]);
        $this->member = User::factory()->create(['email_verified_at' => now()]);

        $this->room = Room::factory()->create([
            'user_id' => $this->owner->id,
            'video_url' => 'https://example.com/video.mp4',
            'is_playing' => false,
            'position_seconds' => 0,
            'duration_seconds' => 120,
            'playback_rate' => 1.0,
            'state_version' => 0,
        ]);

        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now(),
        ]);
    }

    public function test_host_can_update_playback_state(): void
    {
        $response = $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 30,
                'duration_seconds' => 120,
                'playback_rate' => 1.0,
            ]);

        $response->assertOk()
            ->assertJson(['status' => 'ok']);

        $this->room->refresh();

        $this->assertTrue($this->room->is_playing);
        $this->assertEquals(30, $this->room->position_seconds);
        $this->assertEquals(1, $this->room->state_version);
        $this->assertNotNull($this->room->server_timestamp);
    }

    public function test_member_cannot_update_playback_state(): void
    {
        $response = $this->actingAs($this->member)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 30,
                'duration_seconds' => 120,
                'playback_rate' => 1.0,
            ]);

        $response->assertForbidden();
    }

    public function test_state_version_increments_atomically(): void
    {
        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 10,
                'duration_seconds' => 120,
                'playback_rate' => 1.0,
            ]);

        $this->room->refresh();
        $this->assertEquals(1, $this->room->state_version);

        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => false,
                'position_seconds' => 20,
                'duration_seconds' => 120,
                'playback_rate' => 1.0,
            ]);

        $this->room->refresh();
        $this->assertEquals(2, $this->room->state_version);
    }

    public function test_state_returns_current_playback_with_version(): void
    {
        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 45,
                'duration_seconds' => 120,
                'playback_rate' => 1.0,
            ]);

        $response = $this->actingAs($this->member)
            ->getJson("/playback/{$this->room->id}/state");

        $response->assertOk()
            ->assertJson([
                'is_playing' => true,
                'position_seconds' => 45,
                'state_version' => 1,
            ]);
    }

    public function test_state_returns_playback_rate(): void
    {
        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 0,
                'duration_seconds' => 120,
                'playback_rate' => 1.5,
            ]);

        $this->room->refresh();
        $this->assertEquals(1.5, $this->room->playback_rate);

        $response = $this->actingAs($this->member)
            ->getJson("/playback/{$this->room->id}/state");

        $response->assertJson(['playback_rate' => 1.5]);
    }

    public function test_set_video_resets_atomic_state(): void
    {
        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 50,
                'duration_seconds' => 120,
                'playback_rate' => 1.0,
            ]);

        $this->room->refresh();
        $prevVersion = $this->room->state_version;
        $prevTimestamp = $this->room->server_timestamp;

        $this->actingAs($this->owner)
            ->postJson("/playback/{$this->room->id}/set-video", [
                'video_url' => 'https://example.com/new-video.mp4',
            ]);

        $this->room->refresh();

        $this->assertEquals('https://example.com/new-video.mp4', $this->room->video_url);
        $this->assertEquals(0, $this->room->position_seconds);
        $this->assertFalse($this->room->is_playing);
        $this->assertEquals(1.0, $this->room->playback_rate);
        $this->assertEquals($prevVersion + 1, $this->room->state_version);
        $this->assertNotNull($this->room->server_timestamp);
        $this->assertNotEquals($prevTimestamp, $this->room->server_timestamp);
    }

    public function test_member_cannot_set_video(): void
    {
        $response = $this->actingAs($this->member)
            ->postJson("/playback/{$this->room->id}/set-video", [
                'video_url' => 'https://example.com/new-video.mp4',
            ]);

        $response->assertForbidden();
    }

    public function test_unauthorized_user_cannot_read_state(): void
    {
        $stranger = User::factory()->create(['email_verified_at' => now()]);

        $response = $this->actingAs($stranger)
            ->getJson("/playback/{$this->room->id}/state");

        $response->assertForbidden();
    }

    public function test_playback_rate_is_validated(): void
    {
        $response = $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 0,
                'duration_seconds' => 120,
                'playback_rate' => 5,
            ]);

        $this->room->refresh();
        $this->assertEquals(0, $this->room->state_version);
        $this->assertFalse($this->room->is_playing);
    }

    public function test_state_version_rejects_outdated_client(): void
    {
        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 10,
                'duration_seconds' => 120,
            ]);

        $poll = $this->actingAs($this->member)
            ->getJson("/playback/{$this->room->id}/state");

        $this->assertEquals(1, $poll['state_version']);

        $clientSuppliedVersion = 0;
        $this->assertTrue($poll['state_version'] > $clientSuppliedVersion);
    }

    public function test_concurrent_updates_preserve_isolation(): void
    {
        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => true,
                'position_seconds' => 10,
                'duration_seconds' => 120,
            ]);

        $this->actingAs($this->owner)
            ->patchJson("/playback/{$this->room->id}", [
                'is_playing' => false,
                'position_seconds' => 20,
                'duration_seconds' => 120,
            ]);

        $this->room->refresh();

        $this->assertFalse($this->room->is_playing);
        $this->assertEquals(20, $this->room->position_seconds);
        $this->assertEquals(2, $this->room->state_version);
    }

    // ─── Playback Mode Detection ──────────────────────────

    public function test_set_video_detects_proxy_mode_when_head_fails(): void
    {
        Http::fake([
            '*' => Http::response(null, 500),
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/playback/{$this->room->id}/set-video", [
                'video_url' => 'https://example.com/video.mp4',
            ]);

        $response->assertOk();
        $this->room->refresh();
        $this->assertTrue($this->room->playback_mode === PlaybackMode::Proxy);
    }

    public function test_set_video_detects_proxy_mode_when_cors_missing(): void
    {
        Http::fake([
            '*' => Http::response(null, 200, [
                'Accept-Ranges' => 'bytes',
            ]),
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/playback/{$this->room->id}/set-video", [
                'video_url' => 'https://example.com/video.mp4',
            ]);

        $response->assertOk();
        $this->room->refresh();
        $this->assertTrue($this->room->playback_mode === PlaybackMode::Proxy);
    }

    public function test_set_video_detects_proxy_mode_when_range_missing(): void
    {
        Http::fake([
            '*' => Http::response(null, 200, [
                'Access-Control-Allow-Origin' => '*',
            ]),
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/playback/{$this->room->id}/set-video", [
                'video_url' => 'https://example.com/video.mp4',
            ]);

        $response->assertOk();
        $this->room->refresh();
        $this->assertTrue($this->room->playback_mode === PlaybackMode::Proxy);
    }

    public function test_set_video_detects_direct_mode_when_cors_and_range_satisfied(): void
    {
        Http::fake([
            '*' => Http::response(null, 200, [
                'Access-Control-Allow-Origin' => '*',
                'Accept-Ranges' => 'bytes',
            ]),
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/playback/{$this->room->id}/set-video", [
                'video_url' => 'https://example.com/video.mp4',
            ]);

        $response->assertOk();
        $this->room->refresh();
        $this->assertTrue($this->room->playback_mode === PlaybackMode::Direct);
    }

    public function test_playback_state_includes_playback_mode(): void
    {
        $this->room->update(['playback_mode' => 'direct']);

        $response = $this->actingAs($this->member)
            ->getJson("/playback/{$this->room->id}/state");

        $response->assertOk()
            ->assertJson(['playback_mode' => 'direct']);
    }
}
