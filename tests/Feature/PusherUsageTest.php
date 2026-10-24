<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Log\LoggerInterface;
use Pusher\Pusher;
use RuntimeException;
use Tests\TestCase;

class PusherUsageTest extends TestCase
{
    private const CACHE_KEY = 'pusher:usage:backoff:pusher';

    #[DataProvider('failures')]
    public function test_monitoring_errors_are_sanitized_and_skip_requests_during_cooldown(string $error): void
    {
        config(['broadcasting.default' => 'pusher', 'cache.default' => 'array']);
        Log::spy();
        $logger = Mockery::mock(LoggerInterface::class);
        Log::shouldReceive('channel')->with('pusher')->andReturn($logger);
        $logger->shouldReceive('warning')->once()->with('pusher:usage failed', Mockery::on(
            fn ($context) => ! str_contains(json_encode($context), 'SECRET') && $context['retry_after_seconds'] === 300,
        ));
        $pusher = $this->mockPusher();
        $pusher->shouldReceive('getChannels')->once()->andThrow(new RuntimeException($error));

        $this->artisan('pusher:usage')->assertFailed();
        $this->artisan('pusher:usage')->assertSuccessful();
        $this->assertSame(1, Cache::get(self::CACHE_KEY)['failures']);
    }

    public static function failures(): array
    {
        return [['DNS resolution timeout auth_key=SECRET'], ['Connection timed out auth_signature=SECRET'], ['API 401 SECRET']];
    }

    public function test_backoff_is_bounded_and_a_success_resets_it(): void
    {
        config(['broadcasting.default' => 'pusher', 'cache.default' => 'array']);
        Log::spy();
        $logger = Mockery::mock(LoggerInterface::class)->shouldIgnoreMissing();
        Log::shouldReceive('channel')->andReturn($logger);
        $pusher = $this->mockPusher();
        $pusher->shouldReceive('getChannels')->times(7)->andThrow(new RuntimeException('network'));

        foreach ([300, 600, 1200, 2400, 3600, 3600, 3600] as $delay) {
            $this->artisan('pusher:usage')->assertFailed();
            $this->assertSame($delay, Cache::get(self::CACHE_KEY)['next_attempt_at'] - now()->timestamp);
            $this->travel($delay)->seconds();
        }

        $pusher->shouldReceive('getChannels')->once()->andReturn((object) ['channels' => (object) []]);
        $this->artisan('pusher:usage')->assertSuccessful();
        $this->assertNull(Cache::get(self::CACHE_KEY));
    }

    public function test_other_broadcast_drivers_do_not_call_the_monitoring_api(): void
    {
        config(['broadcasting.default' => 'null', 'cache.default' => 'array']);
        $this->artisan('pusher:usage')->assertSuccessful();
    }

    private function mockPusher(): Pusher
    {
        $pusher = Mockery::mock(Pusher::class);
        $manager = Mockery::mock(BroadcastManager::class);
        $manager->shouldReceive('connection')->andReturn(new PusherBroadcaster($pusher));
        $this->app->instance(BroadcastManager::class, $manager);

        return $pusher;
    }
}
