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
        $mockResponse = response()->stream(function (): void {}, $statusCode, [
            'Content-Type' => 'video/mp4',
            'X-Proxy-Error' => 'mocked error',
        ]);

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

        $response->assertNotFound();
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
        $service = $this->stubVideoProxy();

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=0-99',
        ]);

        $response = $service->stream($request, 'https://example.com/video.mp4');

        $this->assertSame(206, $response->getStatusCode());
        $this->assertSame('bytes 0-99/100', $response->headers->get('Content-Range'));
        $this->assertSame('video/mp4', $response->headers->get('Content-Type'));
    }

    public function test_video_proxy_suffix_range_means_last_n_bytes(): void
    {
        $service = $this->stubVideoProxy();

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=-25',
        ]);

        $response = $service->stream($request, 'https://example.com/video.mp4');

        // Content-Length is 100; `bytes=-25` must mean "the last 25 bytes"
        // (75-99), not "start at 0, end at 25".
        $this->assertSame(206, $response->getStatusCode());
        $this->assertSame('bytes 75-99/100', $response->headers->get('Content-Range'));
        $this->assertSame('25', $response->headers->get('Content-Length'));
    }

    public function test_video_proxy_rejects_inverted_range(): void
    {
        $service = $this->stubVideoProxy();

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=50-10',
        ]);

        $response = $service->stream($request, 'https://example.com/video.mp4');

        $this->assertSame(416, $response->getStatusCode());
    }

    public function test_video_proxy_falls_back_to_full_stream_when_origin_ignores_range(): void
    {
        $service = $this->stubVideoProxyWithUpstreamStatus(200);

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=0-99',
        ]);

        $response = $service->stream($request, 'https://example.com/video.mp4');

        // The origin ignored the Range header and returned 200 with the full
        // body, so we must NOT synthesize an incorrect 206/Content-Range.
        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($response->headers->get('Content-Range'));
    }

    public function test_video_proxy_full_stream_omits_accept_ranges_when_origin_lacks_it(): void
    {
        $urlSecurity = new class extends UrlSecurityService
        {
            public function validateVideoUrl(string $url): ?string
            {
                return null;
            }
        };

        $service = new class($urlSecurity) extends VideoProxyService
        {
            public function __construct(UrlSecurityService $urlSecurity)
            {
                parent::__construct($urlSecurity);
            }

            protected function httpGetHeaders(string $url, mixed $context): array|false
            {
                return [
                    'HTTP/1.1 200 OK',
                    'Content-Type' => 'video/mp4',
                    'Content-Length' => '100',
                ];
            }

            protected function openRemoteStream(string $url, mixed $context)
            {
                $stream = fopen('php://temp', 'r+');
                fwrite($stream, str_repeat('x', 100));
                rewind($stream);

                $this->lastStreamStatus = 200;

                return $stream;
            }
        };

        $request = Request::create('/proxy/video/1', 'GET');

        $response = $service->stream($request, 'https://example.com/video.mp4');

        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($response->headers->get('Accept-Ranges'));
    }

    public function test_video_proxy_follows_redirect_on_range_stream_open(): void
    {
        $service = $this->stubVideoProxyWithSequence([
            [
                'status' => 302,
                'headers' => ['HTTP/1.1 302 Found', 'Location' => 'https://cdn.example.org/final.mp4'],
            ],
            [
                'status' => 206,
                'headers' => ['HTTP/1.1 206 Partial Content', 'Content-Range' => 'bytes 0-99/100'],
            ],
        ]);

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=0-99',
        ]);

        $response = $service->stream($request, 'https://example.com/video.mp4');

        // A 3xx on the actual stream open (edge CDN rotated nodes between the
        // probe and the open) must be followed, not relayed as an empty body
        // dressed up as a 206 — that is what caused the Format error.
        $this->assertSame(206, $response->getStatusCode());
        $this->assertSame('bytes 0-99/100', $response->headers->get('Content-Range'));
        $this->assertSame('100', $response->headers->get('Content-Length'));
    }

    public function test_video_proxy_follows_redirect_on_full_stream_open(): void
    {
        $service = $this->stubVideoProxyWithSequence([
            [
                'status' => 302,
                'headers' => ['HTTP/1.1 302 Found', 'Location' => 'https://cdn.example.org/final.mp4'],
            ],
            ['status' => 200, 'headers' => ['HTTP/1.1 200 OK']],
        ]);

        $request = Request::create('/proxy/video/1', 'GET');

        $response = $service->stream($request, 'https://example.com/video.mp4');

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_video_proxy_returns_502_when_upstream_returns_non_2xx_on_stream_open(): void
    {
        $service = $this->stubVideoProxyWithSequence([
            ['status' => 403, 'headers' => ['HTTP/1.1 403 Forbidden']],
        ]);

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=0-99',
        ]);

        $response = $service->stream($request, 'https://example.com/video.mp4');

        // An upstream 403/404/416 body must never be relayed as video bytes.
        $this->assertSame(502, $response->getStatusCode());
        $this->assertNull($response->headers->get('Content-Range'));
    }

    public function test_video_proxy_uses_actual_upstream_content_range_for_206(): void
    {
        $service = $this->stubVideoProxyWithSequence([
            [
                'status' => 206,
                'headers' => [
                    'HTTP/1.1 206 Partial Content',
                    'Content-Range' => 'bytes 5000000-1045340150/1045340151',
                ],
            ],
        ], 1045340151);

        $request = Request::create('/proxy/video/1', 'GET', [], [], [], [
            'HTTP_Range' => 'bytes=5000000-',
        ]);

        $response = $service->stream($request, 'https://example.com/video.mp4');

        // The relayed headers must describe the bytes actually streamed, not a
        // guess computed from the probe — a mismatch here is the seek-time
        // Format error.
        $this->assertSame(206, $response->getStatusCode());
        $this->assertSame('bytes 5000000-1045340150/1045340151', $response->headers->get('Content-Range'));
        $this->assertSame('1040340151', $response->headers->get('Content-Length'));
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

    /**
     * A VideoProxyService whose network layer is faked end-to-end: URL
     * validation always passes, header probes return a fixed 200 response, and
     * stream opens yield an in-memory body. Makes the former network I/O in
     * `stream()` deterministic — no DNS lookups, no outbound HTTP.
     */
    private function stubVideoProxy(): VideoProxyService
    {
        return $this->stubVideoProxyWithUpstreamStatus(206);
    }

    /**
     * Like stubVideoProxy but lets a test control the upstream status reported
     * after a stream open (used to simulate an origin that ignores Range and
     * returns the full body with a 200 status).
     */
    private function stubVideoProxyWithUpstreamStatus(int $status): VideoProxyService
    {
        $urlSecurity = new class extends UrlSecurityService
        {
            public function validateVideoUrl(string $url): ?string
            {
                return null;
            }
        };

        return new class($urlSecurity, $status) extends VideoProxyService
        {
            public function __construct(
                UrlSecurityService $urlSecurity,
                private readonly int $upstreamStatus,
            ) {
                parent::__construct($urlSecurity);
            }

            protected function httpGetHeaders(string $url, mixed $context): array|false
            {
                return [
                    'HTTP/1.1 200 OK',
                    'Content-Type' => 'video/mp4',
                    'Content-Length' => '100',
                    'Accept-Ranges' => 'bytes',
                ];
            }

            protected function openRemoteStream(string $url, mixed $context)
            {
                $stream = fopen('php://temp', 'r+');
                fwrite($stream, str_repeat('x', 100));
                rewind($stream);

                $this->lastStreamStatus = $this->upstreamStatus;

                return $stream;
            }
        };
    }

    /**
     * A VideoProxyService stub whose stream opens return a scripted sequence of
     * upstream responses (status + headers). Lets a test simulate a 3xx on the
     * stream open — e.g. an edge CDN rotating nodes between the fetchHead probe
     * and the actual range GET — and verify redirects are followed.
     */
    private function stubVideoProxyWithSequence(array $responses, int $contentLength = 100): VideoProxyService
    {
        $urlSecurity = new class extends UrlSecurityService
        {
            public function validateVideoUrl(string $url): ?string
            {
                return null;
            }
        };

        return new class($urlSecurity, $responses, $contentLength) extends VideoProxyService
        {
            public function __construct(
                UrlSecurityService $urlSecurity,
                private readonly array $responses,
                private readonly int $probeContentLength,
            ) {
                parent::__construct($urlSecurity);
            }

            private int $openCount = 0;

            protected function httpGetHeaders(string $url, mixed $context): array|false
            {
                return [
                    'HTTP/1.1 200 OK',
                    'Content-Type' => 'video/mp4',
                    'Content-Length' => (string) $this->probeContentLength,
                    'Accept-Ranges' => 'bytes',
                ];
            }

            protected function openRemoteStream(string $url, mixed $context)
            {
                $response = $this->responses[$this->openCount] ?? end($this->responses);
                $this->openCount++;

                $stream = fopen('php://temp', 'r+');
                fwrite($stream, str_repeat('x', 100));
                rewind($stream);

                $this->lastStreamStatus = $response['status'];
                $this->lastStreamHeaders = $response['headers'] ?? [];

                return $stream;
            }
        };
    }

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

    public function test_time_limit_is_reset_on_every_relayed_chunk(): void
    {
        $service = new class(app(UrlSecurityService::class)) extends VideoProxyService
        {
            public int $resets = 0;

            protected function resetTimeLimit(): void
            {
                $this->resets++;
            }
        };

        // 3 chunks worth of content -> the loop iterates multiple times and
        // must reset the execution budget on each iteration (not once before
        // the loop) so a long stream is not truncated by max_execution_time
        // mid-relay. The loop performs one extra iteration to detect EOF.
        $this->captureStreamChunks($service, str_repeat('f', 8192 * 3));

        $this->assertGreaterThanOrEqual(3, $service->resets);
    }
}
