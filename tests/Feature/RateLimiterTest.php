<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RateLimiterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function assertNotRateLimited(\Illuminate\Testing\TestResponse $response, string $label = ''): void
    {
        $this->assertNotEquals(429, $response->getStatusCode(), $label ? "{$label} unexpectedly hit rate limit (429)" : 'Unexpectedly hit rate limit (429)');
    }

    // ─── Login: 5/min per email+IP ──────────────────────────

    #[Test]
    public function login_limits_at_5_attempts_per_email_ip(): void
    {
        $email = 'limit-test@example.com';

        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/login', [
                'email' => $email,
                'password' => 'wrong-password',
            ]);
            $this->assertNotRateLimited($response, "Login attempt $i");
        }

        $response = $this->postJson('/login', [
            'email' => $email,
            'password' => 'wrong-password',
        ]);
        $response->assertStatus(429);
    }

    #[Test]
    public function login_limiter_is_scoped_per_email(): void
    {
        User::factory()->create(['email' => 'scoped-alice@example.com']);
        User::factory()->create(['email' => 'scoped-bob@example.com']);

        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/login', [
                'email' => 'scoped-alice@example.com',
                'password' => 'wrong',
            ]);
            $this->assertNotRateLimited($response, "Alice attempt $i");
        }

        $response = $this->postJson('/login', [
            'email' => 'scoped-alice@example.com',
            'password' => 'wrong',
        ]);
        $response->assertStatus(429);

        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/login', [
                'email' => 'scoped-bob@example.com',
                'password' => 'wrong',
            ]);
            $this->assertNotRateLimited($response, "Bob attempt $i");
        }
    }

    // ─── Chat: 30/min per user ─────────────────────────────

    #[Test]
    public function chat_limits_at_30_messages_per_minute(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $room = Room::factory()->create([
            'user_id' => $user->id,
            'video_url' => 'https://example.com/video.mp4',
        ]);
        RoomMember::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'last_seen_at' => now(),
        ]);

        for ($i = 0; $i < 30; $i++) {
            $response = $this->actingAs($user)
                ->postJson(route('chat.store', $room), ['body' => "Message $i"]);
            $this->assertNotRateLimited($response, "Chat message $i");
        }

        $response = $this->actingAs($user)
            ->postJson(route('chat.store', $room), ['body' => 'One too many']);
        $response->assertStatus(429);
    }

    #[Test]
    public function chat_limiter_is_scoped_per_user(): void
    {
        $user1 = User::factory()->create(['email_verified_at' => now()]);
        $user2 = User::factory()->create(['email_verified_at' => now()]);
        $room = Room::factory()->create([
            'user_id' => $user1->id,
            'video_url' => 'https://example.com/video.mp4',
        ]);
        collect([$user1, $user2])->each(fn ($u) => RoomMember::create([
            'room_id' => $room->id, 'user_id' => $u->id, 'last_seen_at' => now(),
        ]));

        for ($i = 0; $i < 30; $i++) {
            $response = $this->actingAs($user1)
                ->postJson(route('chat.store', $room), ['body' => "m $i"]);
            $this->assertNotRateLimited($response, "User1 message $i");
        }

        $response = $this->actingAs($user1)
            ->postJson(route('chat.store', $room), ['body' => 'blocked']);
        $response->assertStatus(429);

        $response = $this->actingAs($user2)
            ->postJson(route('chat.store', $room), ['body' => 'User2 message']);
        $this->assertNotRateLimited($response, 'User2 should not be blocked');
    }

    // ─── Playback: 60/min per user ──────────────────────────

    #[Test]
    public function playback_limits_at_60_updates_per_minute(): void
    {
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $room = Room::factory()->create([
            'user_id' => $owner->id,
            'video_url' => 'https://example.com/video.mp4',
            'is_playing' => false,
            'position_seconds' => 0,
            'duration_seconds' => 120,
            'playback_rate' => 1.0,
            'state_version' => 0,
        ]);
        RoomMember::create([
            'room_id' => $room->id, 'user_id' => $owner->id, 'last_seen_at' => now(),
        ]);

        for ($i = 0; $i < 60; $i++) {
            $response = $this->actingAs($owner)
                ->patchJson("/playback/{$room->id}", [
                    'is_playing' => $i % 2 === 0,
                    'position_seconds' => $i,
                    'duration_seconds' => 120,
                    'playback_rate' => 1.0,
                ]);
            $this->assertNotRateLimited($response, "Playback update $i");
        }

        $response = $this->actingAs($owner)
            ->patchJson("/playback/{$room->id}", [
                'is_playing' => false,
                'position_seconds' => 0,
                'duration_seconds' => 120,
                'playback_rate' => 1.0,
            ]);
        $response->assertStatus(429);
    }

    // ─── Video Proxy: 30/min per user ───────────────────────

    #[Test]
    public function proxy_limits_at_30_requests_per_minute(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $room = Room::factory()->create([
            'user_id' => $user->id,
            'video_url' => null,
        ]);
        RoomMember::create([
            'room_id' => $room->id, 'user_id' => $user->id, 'last_seen_at' => now(),
        ]);

        for ($i = 0; $i < 30; $i++) {
            $response = $this->actingAs($user)
                ->getJson("/proxy/video/{$room->id}");
            $this->assertNotRateLimited($response, "Proxy request $i");
        }

        $response = $this->actingAs($user)
            ->getJson("/proxy/video/{$room->id}");
        $response->assertStatus(429);
    }

    // ─── Presence: 60/min per user ─────────────────────────

    #[Test]
    public function presence_limits_at_60_heartbeats_per_minute(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $room = Room::factory()->create([
            'user_id' => $user->id,
            'video_url' => 'https://example.com/video.mp4',
        ]);
        RoomMember::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'last_seen_at' => now(),
            'presence_status' => 'online',
            'heartbeat_version' => 0,
            'joined_at' => now(),
        ]);

        for ($i = 0; $i < 60; $i++) {
            $response = $this->actingAs($user)
                ->postJson("/presence/{$room->id}/heartbeat");
            $this->assertNotRateLimited($response, "Heartbeat $i");
        }

        $response = $this->actingAs($user)
            ->postJson("/presence/{$room->id}/heartbeat");
        $response->assertStatus(429);
    }
}
