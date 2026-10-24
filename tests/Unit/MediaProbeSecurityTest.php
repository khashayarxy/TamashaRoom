<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\UrlSecurityService;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Promise\FulfilledPromise;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Psr\Http\Message\RequestInterface;
use Tests\TestCase;

class MediaProbeSecurityTest extends TestCase
{
    public function test_public_redirects_are_resolved_and_pinned_per_hop(): void
    {
        $hosts = [];
        $requests = [];
        $service = new UrlSecurityService(
            dnsResolver: static function (string $host) use (&$hosts): array {
                $hosts[] = $host;

                return [$host === 'cdn.example.com' ? '8.8.4.4' : '8.8.8.8'];
            },
            probeHandler: static function (RequestInterface $request, array $options) use (&$requests) {
                $requests[] = [(string) $request->getUri(), $options['curl'][CURLOPT_RESOLVE], $options['proxy'], $options['allow_redirects']];
                $response = count($requests) === 1
                    ? new Response(302, ['Location' => '//cdn.example.com/final.mp4'])
                    : new Response(206, [], $options['sink']);
                $options['on_headers']($response);
                if ($response->getStatusCode() === 206) {
                    $options['sink']->write('media');
                }

                return new FulfilledPromise($response);
            },
        );
        $this->assertSame('media', $service->fetchRangeBytes('https://example.com/start.mp4'));
        $this->assertSame(['example.com', 'cdn.example.com'], $hosts);
        $this->assertSame(['example.com:443:8.8.8.8'], $requests[0][1]);
        $this->assertSame(['cdn.example.com:443:8.8.4.4'], $requests[1][1]);
        $this->assertSame('', $requests[0][2]);
        $this->assertFalse($requests[0][3]);
    }

    public function test_private_redirect_is_never_sent(): void
    {
        Http::fake(['*' => Http::response('', 302, ['Location' => 'http://127.0.0.1/private'])]);
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8']);
        $this->assertNull($service->fetchRangeBytes('https://example.com/video'));
        Http::assertSentCount(1);
    }

    public function test_redirect_loop_and_limit_are_bounded(): void
    {
        $count = 0;
        Http::fake(static function () use (&$count) {
            return Http::response('', 302, ['Location' => '/hop'.++$count]);
        });
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8']);
        $this->assertNull($service->fetchRangeBytes('https://example.com/start'));
        Http::assertSentCount(6);
    }

    public function test_relative_redirect_loop_stops_before_a_second_request(): void
    {
        Http::fake(['*' => Http::response('', 302, ['Location' => '/video'])]);
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8']);
        $this->assertNull($service->fetchRangeBytes('https://example.com/video'));
        Http::assertSentCount(1);
    }

    #[DataProvider('unsafeUrls')]
    public function test_unsafe_destinations_never_reach_transport(string $url): void
    {
        Http::fake();
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8']);
        $this->assertNotNull($service->validateVideoUrl($url));
        $this->assertNull($service->fetchRangeBytes($url));
        Http::assertNothingSent();
    }

    public static function unsafeUrls(): array
    {
        return array_map(static fn (string $url): array => [$url], [
            'http://127.1/video', 'http://2130706433/video', 'http://0x7f000001/video',
            'http://0177.0.0.1/video', 'http://169.254.169.254/video', 'http://100.64.1.1/video',
            'http://192.0.2.1/video', 'http://224.0.0.1/video', 'http://240.0.0.1/video',
            'http://[::ffff:127.0.0.1]/video', 'http://[2001:db8::1]/video',
            'http://[2002:7f00:1::]/video', 'http://[64:ff9b::7f00:1]/video',
            'https://user:password@example.com/video', 'ftp://example.com/video',
            'https://localhost./video', 'http://example.com:0/video', "http://example.com/\r\nHost: local",
        ]);
    }

    public function test_mixed_public_and_private_dns_answers_are_rejected(): void
    {
        Http::fake();
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8', '10.0.0.1']);
        $this->assertNull($service->fetchRangeBytes('https://example.com/video'));
        Http::assertNothingSent();
    }

    #[DataProvider('upstreamLengths')]
    public function test_real_transport_sink_aborts_without_buffering_the_full_body(array $headers): void
    {
        $written = 0;
        $service = new UrlSecurityService(
            dnsResolver: static fn (): array => ['8.8.8.8'],
            probeHandler: static function (RequestInterface $request, array $options) use (&$written, $headers) {
                $options['on_headers'](new Response(200, $headers));
                $written += $options['sink']->write(str_repeat('a', 32));
                $written += $options['sink']->write(str_repeat('b', 32));
                throw new ConnectException('Controlled short-write abort', $request);
            },
        );
        $this->assertSame(str_repeat('a', 32).str_repeat('b', 16), $service->fetchRangeBytes('https://example.com/video', 48));
        $this->assertSame(48, $written);
    }

    public static function upstreamLengths(): array
    {
        return [[[]], [['Content-Length' => '1']], [['Content-Length' => '999999999']], [['Transfer-Encoding' => 'chunked']]];
    }

    public function test_ignoring_range_still_returns_only_a_bounded_prefix(): void
    {
        Http::fake(['*' => Http::response(str_repeat('x', 131072), 200)]);
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8']);
        $this->assertSame(65536, strlen($service->fetchRangeBytes('https://example.com/video', 999999)));
    }

    public function test_native_proxy_pins_ip_host_and_tls_identity_without_a_second_resolution(): void
    {
        $lookups = 0;
        $service = new UrlSecurityService(dnsResolver: static function () use (&$lookups): array {
            return ++$lookups === 1 ? ['8.8.8.8'] : ['127.0.0.1'];
        });
        $target = $service->pinStreamDestination('https://example.com:8443/video?q=1', stream_context_create(['http' => ['header' => ['Range: bytes=0-9']]]));
        $this->assertSame('https://8.8.8.8:8443/video?q=1', $target['url']);
        $options = stream_context_get_options($target['context']);
        $this->assertContains('Host: example.com:8443', $options['http']['header']);
        $this->assertSame('example.com', $options['ssl']['peer_name']);
        $this->assertTrue($options['ssl']['verify_peer']);
        $this->assertSame(1, $lookups);
    }

    public function test_header_probe_checks_redirect_destination_too(): void
    {
        Http::fake(['*' => Http::response('', 302, ['Location' => 'http://10.0.0.1/private'])]);
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8']);
        $this->assertNull($service->probeHeaders('https://example.com/video'));
        Http::assertSentCount(1);
    }

    public function test_transport_failure_has_bounded_timeouts_and_closes_the_sink(): void
    {
        $sink = null;
        $service = new UrlSecurityService(
            dnsResolver: static fn (): array => ['8.8.8.8'],
            probeHandler: function (RequestInterface $request, array $options) use (&$sink) {
                $sink = $options['sink'];
                $this->assertGreaterThan(0, $options['timeout']);
                $this->assertLessThanOrEqual(3, $options['timeout']);
                $this->assertLessThanOrEqual(2, $options['connect_timeout']);
                throw new ConnectException('Simulated DNS or TLS timeout', $request);
            },
        );
        $this->assertNull($service->fetchRangeBytes('https://example.com/video?token=PRIVATE'));
        $this->assertFalse($sink->isWritable());
    }

    public function test_malformed_redirect_is_rejected_without_another_request(): void
    {
        Http::fake(['*' => Http::response('', 302, ['Location' => 'http://[::1'])]);
        $service = new UrlSecurityService(dnsResolver: static fn (): array => ['8.8.8.8']);
        $this->assertNull($service->fetchRangeBytes('https://example.com/video'));
        Http::assertSentCount(1);
    }
}
