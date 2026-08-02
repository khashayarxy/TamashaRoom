<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomMember;
use App\Models\User;
use App\Services\UrlSecurityService;
use App\Services\VideoProxyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class VideoStreamTest extends TestCase
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
            'video_url' => 'https://example.com/video.mp4',
            'is_playing' => false,
            'position_seconds' => 0,
            'duration_seconds' => 120,
        ]);

        RoomMember::create([
            'room_id' => $this->room->id,
            'user_id' => $this->member->id,
            'last_seen_at' => now(),
        ]);
    }

    private function mockProxySuccess(): void
    {
        $mockResponse = response()->stream(function (): void {
            echo 'test';
        }, 200, [
            'Content-Type' => 'video/mp4',
            'Accept-Ranges' => 'bytes',
            'Content-Length' => '4',
            'X-Proxy' => 'TamashaRoom/1.0',
        ]);

        $this->mock(VideoProxyService::class, function ($mock) use ($mockResponse): void {
            $mock->shouldReceive('stream')
                ->andReturn($mockResponse);
        });
    }

    private function mockProxyError(int $statusCode): void
    {
        $mockResponse = response()->stream(function (): void {
            echo json_encode(['error' => 'mocked error']);
        }, $statusCode, ['Content-Type' => 'application/json']);

        $this->mock(VideoProxyService::class, function ($mock) use ($mockResponse): void {
            $mock->shouldReceive('stream')
                ->andReturn($mockResponse);
        });
    }

    public function test_owner_can_access_proxy(): void
    {
        $this->mockProxySuccess();

        $response = $this->actingAs($this->owner)
            ->get("/proxy/video/{$this->room->id}");

        $response->assertStatus(200)
            ->assertHeader('X-Proxy', 'TamashaRoom/1.0')
            ->assertHeader('Accept-Ranges', 'bytes')
            ->assertHeader('Content-Type', 'video/mp4');
    }

    public function test_member_can_access_proxy(): void
    {
        $this->mockProxySuccess();

        $response = $this->actingAs($this->member)
            ->get("/proxy/video/{$this->room->id}");

        $response->assertStatus(200)
            ->assertHeader('X-Proxy', 'TamashaRoom/1.0')
            ->assertHeader('Accept-Ranges', 'bytes');
    }

    public function test_stranger_cannot_access_proxy(): void
    {
        $response = $this->actingAs($this->stranger)
            ->get("/proxy/video/{$this->room->id}");

        $response->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_access_proxy(): void
    {
        $response = $this->get("/proxy/video/{$this->room->id}");

        $response->assertRedirect();
    }

    public function test_proxy_returns_404_when_no_video(): void
    {
        $room = Room::factory()->create([
            'user_id' => $this->owner->id,
            'video_url' => null,
        ]);

        RoomMember::create([
            'room_id' => $room->id,
            'user_id' => $this->owner->id,
            'last_seen_at' => now(),
        ]);

        $response = $this->actingAs($this->owner)
            ->get("/proxy/video/{$room->id}");

        $response->assertStatus(404);
    }

    public function test_proxy_rejects_invalid_scheme(): void
    {
        $room = Room::factory()->create([
            'user_id' => $this->owner->id,
            'video_url' => 'ftp://evil.com/video.mp4',
        ]);

        RoomMember::create([
            'room_id' => $room->id,
            'user_id' => $this->owner->id,
            'last_seen_at' => now(),
        ]);

        $this->mockProxyError(400);

        $response = $this->actingAs($this->owner)
            ->get("/proxy/video/{$room->id}");

        $response->assertStatus(400);
    }

    public function test_video_proxy_service_detects_content_type_from_extension(): void
    {
        $service = app(VideoProxyService::class);

        $detect = new \ReflectionMethod($service, 'detectContentType');

        $this->assertEquals('video/mp4', $detect->invoke($service, null, 'https://example.com/video.mp4'));
        $this->assertEquals('video/webm', $detect->invoke($service, null, 'https://example.com/video.webm'));
        $this->assertEquals('video/x-matroska', $detect->invoke($service, null, 'https://example.com/video.mkv'));
        $this->assertEquals('video/mp4', $detect->invoke($service, null, 'https://example.com/video'));
    }

    public function test_video_proxy_service_prefers_remote_content_type_over_extension(): void
    {
        $service = app(VideoProxyService::class);

        $detect = new \ReflectionMethod($service, 'detectContentType');

        $this->assertEquals(
            'video/webm',
            $detect->invoke($service, 'video/webm', 'https://example.com/video.mp4'),
        );
    }

    public function test_video_proxy_service_ignores_octet_stream(): void
    {
        $service = app(VideoProxyService::class);

        $detect = new \ReflectionMethod($service, 'detectContentType');

        $this->assertEquals(
            'video/mp4',
            $detect->invoke($service, 'application/octet-stream', 'https://example.com/video.mp4'),
        );
    }

    public function test_video_proxy_validates_range_format(): void
    {
        $service = app(VideoProxyService::class);

        $stream = new \ReflectionMethod($service, 'stream');
        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'invalid',
        ]);

        $response = $stream->invoke($service, $request, 'https://example.com/video.mp4');

        $this->assertEquals(400, $response->getStatusCode());
    }

    public function test_video_proxy_returns_206_for_valid_range(): void
    {
        $service = app(VideoProxyService::class);

        $stream = new \ReflectionMethod($service, 'stream');

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=0-99',
        ]);

        $response = $stream->invoke($service, $request, 'https://example.com/video.mp4');

        $this->assertContains($response->getStatusCode(), [206, 502]);
    }

    public function test_proxy_stream_context_enables_tls_verification(): void
    {
        $service = app(VideoProxyService::class);

        $createContext = new \ReflectionMethod($service, 'createStreamContext');

        $context = $createContext->invoke($service, ['User-Agent: TamashaRoom/1.0']);
        $options = stream_context_get_options($context);

        $this->assertTrue($options['ssl']['verify_peer']);
        $this->assertTrue($options['ssl']['verify_peer_name']);
        $this->assertSame(0, $options['http']['follow_location']);
        $this->assertSame(0, $options['http']['max_redirects']);
    }

    public function test_proxy_resolves_absolute_redirect_url(): void
    {
        $service = app(VideoProxyService::class);

        $resolve = new \ReflectionMethod($service, 'resolveRelativeUrl');

        $result = $resolve->invoke(
            $service,
            'https://example.com/a/video.mp4',
            'https://cdn.example.org/final.mp4',
        );

        $this->assertSame('https://cdn.example.org/final.mp4', $result);
    }

    public function test_proxy_resolves_root_relative_redirect_url(): void
    {
        $service = app(VideoProxyService::class);

        $resolve = new \ReflectionMethod($service, 'resolveRelativeUrl');

        $result = $resolve->invoke(
            $service,
            'https://example.com/a/video.mp4',
            '/final.mp4',
        );

        $this->assertSame('https://example.com/final.mp4', $result);
    }

    public function test_proxy_resolves_path_relative_redirect_url(): void
    {
        $service = app(VideoProxyService::class);

        $resolve = new \ReflectionMethod($service, 'resolveRelativeUrl');

        $result = $resolve->invoke(
            $service,
            'https://example.com/a/video.mp4',
            'final.mp4',
        );

        $this->assertSame('https://example.com/a/final.mp4', $result);
    }

    public function test_proxy_resolves_protocol_relative_redirect_url(): void
    {
        $service = app(VideoProxyService::class);

        $resolve = new \ReflectionMethod($service, 'resolveRelativeUrl');

        $result = $resolve->invoke(
            $service,
            'https://example.com/a/video.mp4',
            '//cdn.example.org/final.mp4',
        );

        $this->assertSame('https://cdn.example.org/final.mp4', $result);
    }

    public function test_proxy_fetch_head_rejects_blocked_host(): void
    {
        $service = app(VideoProxyService::class);

        $fetchHead = new \ReflectionMethod($service, 'fetchHead');

        $result = $fetchHead->invoke($service, 'http://127.0.0.1/video.mp4');

        $this->assertNull($result);
    }

    public function test_proxy_fetch_head_rejects_ftp_redirect_target(): void
    {
        $service = app(VideoProxyService::class);

        $fetchHead = new \ReflectionMethod($service, 'fetchHead');

        $result = $fetchHead->invoke($service, 'ftp://example.com/video.mp4');

        $this->assertNull($result);
    }

    // ─── Actual-bytes streaming cap (MAX_FILE_SIZE enforced on relayed bytes) ───

    private function proxyWithMaxRelayedBytes(int $maxBytes): VideoProxyService
    {
        return new class(app(UrlSecurityService::class), $maxBytes) extends VideoProxyService
        {
            public function __construct(
                UrlSecurityService $urlSecurity,
                private readonly int $maxBytes,
            ) {
                parent::__construct($urlSecurity);
            }

            protected function maxRelayedBytes(): int
            {
                return $this->maxBytes;
            }
        };
    }

    private function captureStreamChunks(VideoProxyService $service, string $content): string
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $content);
        rewind($stream);

        $streamChunks = new \ReflectionMethod($service, 'streamChunks');

        ob_start();
        try {
            $streamChunks->invoke($service, $stream);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        return (string) ob_get_clean();
    }

    public function test_stream_relays_all_bytes_when_content_length_is_within_max_file_size(): void
    {
        $service = $this->proxyWithMaxRelayedBytes(8192 * 3);

        $content = str_repeat('a', 8192 * 2);

        $this->assertSame($content, $this->captureStreamChunks($service, $content));
    }

    public function test_stream_stops_at_max_file_size_when_content_length_is_missing(): void
    {
        $service = $this->proxyWithMaxRelayedBytes(8192 * 3);

        $relayed = $this->captureStreamChunks($service, str_repeat('b', 8192 * 10));

        $this->assertSame(8192 * 3, strlen($relayed));
        $this->assertSame(str_repeat('b', 8192 * 3), $relayed);
    }

    public function test_stream_never_relays_more_than_max_file_size_even_with_larger_content_length(): void
    {
        $service = $this->proxyWithMaxRelayedBytes(8192 * 3);

        $relayed = $this->captureStreamChunks($service, str_repeat('c', 8192 * 100));

        $this->assertLessThanOrEqual(8192 * 3, strlen($relayed));
        $this->assertSame(8192 * 3, strlen($relayed));
    }

    public function test_stream_handles_exact_max_file_size_boundary(): void
    {
        $service = $this->proxyWithMaxRelayedBytes(8192 * 2);

        $exact = str_repeat('d', 8192 * 2);

        $this->assertSame($exact, $this->captureStreamChunks($service, $exact));

        $over = str_repeat('e', (8192 * 2) + 1);

        $this->assertSame(8192 * 2, strlen($this->captureStreamChunks($service, $over)));
    }

    public function test_default_max_file_size_is_four_gigabytes(): void
    {
        $service = app(VideoProxyService::class);

        $max = new \ReflectionMethod($service, 'maxRelayedBytes');

        $this->assertSame(4 * 1024 * 1024 * 1024, $max->invoke($service));
    }
}
