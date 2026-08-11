<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use App\Services\VideoProxyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PlaybackDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function assertNotRateLimited(TestResponse $response, string $label = ''): void
    {
        $this->assertNotEquals(429, $response->getStatusCode(), $label ? "{$label} unexpectedly hit rate limit (429)" : 'Unexpectedly hit rate limit (429)');
    }

    private function userWithRoom(?string $videoUrl = 'https://example.com/video.mp4'): array
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $room = Room::factory()->create([
            'user_id' => $user->id,
            'video_url' => $videoUrl,
        ]);
        RoomMember::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'last_seen_at' => now(),
        ]);

        return [$user, $room];
    }

    #[Test]
    public function playback_exhaustion_logs_rate_limited_diagnostics_with_limiter_name_and_count(): void
    {
        [$user, $room] = $this->userWithRoom();

        Log::spy();

        foreach (range(0, 59) as $i) {
            $response = $this->actingAs($user)->patchJson(route('playback.update', $room), [
                'is_playing' => (bool) ($i % 2),
                'position_seconds' => $i,
                'duration_seconds' => 3600,
                'playback_rate' => 1.0,
            ]);
            $this->assertNotRateLimited($response, "Sync attempt $i");
        }

        $this->actingAs($user)
            ->patchJson(route('playback.update', $room), [
                'is_playing' => true,
                'position_seconds' => 61,
                'duration_seconds' => 3600,
            ])
            ->assertStatus(429);

        Log::shouldHaveReceived('warning')->withArgs(
            fn (string $message, array $context): bool => str_contains($message, '[diagnostics:playback]')
                && ($context['http_status'] ?? null) === 429
                && ($context['rate_limited'] ?? false) === true
                && ($context['limiter'] ?? null) === 'playback'
                && ($context['limiter_limit'] ?? null) === 60
                && ($context['limiter_current_count'] ?? 0) >= 59
                && ($context['endpoint'] ?? null) === 'playback.update'
                && ($context['room_id'] ?? null) == $room->id,
        );
    }

    #[Test]
    public function proxy_exhaustion_logs_proxy_limiter_diagnostics(): void
    {
        [$user, $room] = $this->userWithRoom(null);

        Log::spy();

        for ($i = 0; $i < 30; $i++) {
            $response = $this->actingAs($user)->getJson("/proxy/video/{$room->id}");
            $this->assertNotRateLimited($response, "Proxy request $i");
        }

        $this->actingAs($user)->getJson("/proxy/video/{$room->id}")->assertStatus(429);

        Log::shouldHaveReceived('warning')->withArgs(
            fn (string $message, array $context): bool => str_contains($message, '[diagnostics:proxy]')
                && ($context['http_status'] ?? null) === 429
                && ($context['rate_limited'] ?? false) === true
                && ($context['limiter'] ?? null) === 'proxy'
                && ($context['limiter_limit'] ?? null) === 30
                && ($context['limiter_current_count'] ?? 0) >= 29
                && ($context['endpoint'] ?? null) === 'proxy.video'
                && ($context['room_id'] ?? null) == $room->id,
        );
    }

    #[Test]
    public function proxy_upstream_failure_is_logged_as_a_genuine_failure(): void
    {
        [$user, $room] = $this->userWithRoom();

        $this->mock(VideoProxyService::class, function ($mock): void {
            $mock->shouldReceive('stream')->andReturn(response()->json(['status' => 'error'], 502));
        });

        Log::spy();

        $this->actingAs($user)->getJson("/proxy/video/{$room->id}")->assertStatus(502);

        Log::shouldHaveReceived('error')->withArgs(
            fn (string $message, array $context): bool => str_contains($message, '[diagnostics:proxy]')
                && ($context['http_status'] ?? null) === 502
                && ($context['rate_limited'] ?? true) === false
                && ($context['failure_type'] ?? null) === 'upstream'
                && ($context['endpoint'] ?? null) === 'proxy.video'
                && ($context['room_id'] ?? null) == $room->id,
        );
    }

    #[Test]
    public function playback_validation_failure_is_logged_as_a_genuine_failure(): void
    {
        [$user, $room] = $this->userWithRoom();

        Log::spy();

        $this->actingAs($user)
            ->patchJson(route('playback.update', $room), [])
            ->assertStatus(422);

        Log::shouldHaveReceived('warning')->withArgs(
            fn (string $message, array $context): bool => str_contains($message, '[diagnostics:playback]')
                && ($context['http_status'] ?? null) === 422
                && ($context['rate_limited'] ?? true) === false
                && ($context['failure_type'] ?? null) === 'validation'
                && ($context['endpoint'] ?? null) === 'playback.update'
                && ($context['room_id'] ?? null) == $room->id,
        );
    }

    #[Test]
    public function state_denied_for_non_member_is_logged_as_a_genuine_failure(): void
    {
        $owner = User::factory()->create(['email_verified_at' => now()]);
        $room = Room::factory()->create([
            'user_id' => $owner->id,
            'video_url' => null,
        ]);
        $outsider = User::factory()->create(['email_verified_at' => now()]);

        Log::spy();

        $this->actingAs($outsider)->getJson(route('playback.state', $room))->assertStatus(404);

        Log::shouldHaveReceived('warning')->withArgs(
            fn (string $message, array $context): bool => str_contains($message, '[diagnostics:playback]')
                && ($context['http_status'] ?? null) === 404
                && ($context['rate_limited'] ?? true) === false
                && ($context['failure_type'] ?? null) === 'not_found'
                && ($context['endpoint'] ?? null) === 'playback.state'
                && ($context['room_id'] ?? null) == $room->id,
        );
    }
}
