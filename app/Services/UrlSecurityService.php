<?php

declare(strict_types=1);

namespace App\Services;

use Closure;
use GuzzleHttp\Handler\CurlHandler;
use GuzzleHttp\Psr7\FnStream;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

class UrlSecurityService
{
    private const MAX_PROBE_BYTES = 65536;

    private const MAX_REDIRECTS = 5;

    /**
     * Test seams replace DNS and the innermost transport, never validation.
     *
     * @param  Closure(string): list<string>|null  $dnsResolver
     * @param  Closure(RequestInterface, array): mixed|null  $probeHandler
     */
    public function __construct(
        private readonly ?Closure $dnsResolver = null,
        private readonly ?Closure $probeHandler = null,
    ) {}

    public function validateVideoUrl(string $url): ?string
    {
        return $this->inspectDestination($url)['error'];
    }

    public function fetchRangeBytes(string $url, int $length = self::MAX_PROBE_BYTES, int $timeoutSeconds = 3): ?string
    {
        $result = $this->probe($url, 'GET', max(1, min($length, self::MAX_PROBE_BYTES)), $timeoutSeconds);

        return $result['bytes'] ?? null;
    }

    public function probeHeaders(string $url, int $timeoutSeconds = 3): ?Response
    {
        $result = $this->probe($url, 'HEAD', 0, $timeoutSeconds);

        return $result['response'] ?? null;
    }

    /**
     * Native streams connect to a checked literal IP, retaining the HTTP Host
     * and TLS peer name/SNI. PHP's wrapper otherwise performs a second DNS lookup.
     *
     * @param  resource  $context
     * @return array{url: string, context: resource}|null
     */
    public function pinStreamDestination(string $url, mixed $context): ?array
    {
        $destination = $this->inspectDestination($url);
        if ($destination['error'] !== null) {
            return null;
        }
        $ip = $destination['ips'][0];
        $uri = new Uri($url);
        $options = stream_context_get_options($context);
        $headers = $options['http']['header'] ?? [];
        $headers = is_array($headers) ? $headers : explode("\r\n", $headers);
        $headers = array_values(array_filter($headers, static fn (string $header): bool => ! str_starts_with(strtolower($header), 'host:')));
        $headers[] = 'Host: '.$uri->getAuthority();
        $options['http']['header'] = $headers;
        $options['http']['follow_location'] = 0;
        $options['ssl']['peer_name'] = $destination['host'];
        $options['ssl']['SNI_enabled'] = true;
        $options['ssl']['verify_peer'] = true;
        $options['ssl']['verify_peer_name'] = true;

        return [
            'url' => (string) $uri->withHost(str_contains($ip, ':') ? '['.$ip.']' : $ip),
            'context' => stream_context_create($options),
        ];
    }

    /** @return array{response: Response|null, bytes: string}|null */
    private function probe(string $url, string $method, int $limit, int $timeoutSeconds): ?array
    {
        $deadline = microtime(true) + max(1, min($timeoutSeconds, 10));
        $visited = [];
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            $destination = $this->inspectDestination($url);
            $remaining = $deadline - microtime(true);
            if ($destination['error'] !== null || $remaining <= 0 || isset($visited[$url])) {
                return null;
            }
            $url = (string) (new Uri($url))->withHost(str_contains($destination['host'], ':') ? '['.$destination['host'].']' : $destination['host'])->withFragment('');
            $visited[$url] = true;
            $buffer = Utils::streamFor('');
            $status = null;
            $capped = false;
            $sink = FnStream::decorate($buffer, [
                'write' => static function (string $chunk) use ($buffer, $limit, &$capped): int {
                    $available = max(0, $limit - $buffer->getSize());
                    $written = $available > 0 ? $buffer->write(substr($chunk, 0, $available)) : 0;
                    $capped = $capped || $written < strlen($chunk);

                    // A short write aborts libcurl; only the bounded prefix is
                    // retained, regardless of Content-Length or transfer coding.
                    return $written;
                },
            ]);
            try {
                if (! extension_loaded('curl')) {
                    return null;
                }
                $address = $destination['ips'][0];
                $resolve = $destination['host'].':'.$destination['port'].':'.(str_contains($address, ':') ? '['.$address.']' : $address);
                $response = Http::withoutRedirecting()
                    ->timeout($remaining)
                    ->connectTimeout(min(2, $remaining))
                    ->withHeaders(array_filter([
                        'Range' => $method === 'GET' ? 'bytes=0-'.($limit - 1) : null,
                        'User-Agent' => 'TamashaRoom/1.0',
                    ]))
                    ->withOptions([
                        'proxy' => '',
                        'decode_content' => false,
                        'curl' => [
                            CURLOPT_RESOLVE => filter_var($destination['host'], FILTER_VALIDATE_IP) ? [] : [$resolve],
                            CURLOPT_FRESH_CONNECT => true,
                            CURLOPT_FORBID_REUSE => true,
                        ],
                        'on_headers' => static function (ResponseInterface $response) use (&$status): void {
                            $status = $response->getStatusCode();
                        },
                    ])
                    ->setHandler(function (RequestInterface $request, array $options) use ($sink) {
                        // This sits below Laravel's fake layer: production has
                        // a bounded sink, while Http::fake remains hermetic.
                        $options['sink'] = $sink;

                        return ($this->probeHandler ?? new CurlHandler)($request, $options);
                    })
                    ->send($method, $url);

                if (in_array($response->status(), [301, 302, 303, 307, 308], true)) {
                    $location = $response->header('Location');
                    if ($location === '') {
                        return null;
                    }
                    $url = (string) UriResolver::resolve(new Uri($url), new Uri($location));

                    continue;
                }
                if (! $response->successful()) {
                    return null;
                }
                $body = $response->toPsrResponse()->getBody();
                if ($body->isSeekable()) {
                    $body->rewind();
                }

                return ['response' => $response, 'bytes' => $limit > 0 ? Utils::copyToString($body, $limit) : ''];
            } catch (\Throwable $e) {
                if ($capped && $status !== null && $status >= 200 && $status < 300) {
                    $buffer->rewind();

                    return ['response' => null, 'bytes' => $buffer->read($limit)];
                }
                // Signed media URLs and exception text may contain credentials.
                Log::info('Media probe failed', ['exception' => $e::class]);

                return null;
            } finally {
                $sink->close();
            }
        }

        return null;
    }

    /** @return array{error: ?string, host: string, port: int, ips: list<string>} */
    private function inspectDestination(string $url): array
    {
        $result = ['error' => 'This video source is not allowed.', 'host' => '', 'port' => 0, 'ips' => []];
        if (! filter_var($url, FILTER_VALIDATE_URL) || preg_match('/[\x00-\x20\x7f\\\\]/', $url)) {
            return $result;
        }
        $parts = parse_url($url);
        if ($parts === false || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || isset($parts['user']) || isset($parts['pass'])) {
            return $result;
        }
        $host = strtolower(rtrim(trim($parts['host'] ?? '', '[]'), '.'));
        if ($host === '' || str_contains($host, '%')) {
            return $result;
        }
        // libcurl accepts shorthand/hex/octal IPv4 forms. They must not be
        // treated as DNS names, where CURLOPT_RESOLVE could then be bypassed.
        if (! filter_var($host, FILTER_VALIDATE_IP) && preg_match('/^(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+))*$/i', $host)) {
            return $result;
        }
        if (isset($parts['port']) && $parts['port'] < 1) {
            return $result;
        }
        $local = app()->environment('local');
        if (! $local && ($host === 'localhost' || preg_match('/\.(?:local|localhost|internal)$/', $host))) {
            return $result;
        }
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : $this->resolveToIps($host);
        if ($ips === []) {
            return $result;
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP) || (! $local && $this->isPrivateIp($ip))) {
                return $result;
            }
        }

        return ['error' => null, 'host' => $host, 'port' => $parts['port'] ?? (strtolower($parts['scheme']) === 'https' ? 443 : 80), 'ips' => array_values($ips)];
    }

    /** @return list<string> */
    private function resolveToIps(string $host): array
    {
        if ($this->dnsResolver !== null) {
            return array_values(array_unique(($this->dnsResolver)($host)));
        }
        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        if ($records === false || $records === []) {
            $ip = @gethostbyname($host);

            return $ip !== $host && filter_var($ip, FILTER_VALIDATE_IP) ? [$ip] : [];
        }
        $ips = [];
        foreach ($records as $record) {
            if (isset($record['ip'])) {
                $ips[] = $record['ip'];
            } elseif (isset($record['ipv6'])) {
                $ips[] = $record['ipv6'];
            }
        }

        return array_values(array_unique($ips));
    }

    private function isPrivateIp(string $ip): bool
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && (int) explode('.', $ip)[0] >= 224) {
            return true;
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $binary = inet_pton($ip);
            $hex = bin2hex($binary);
            if (str_starts_with($hex, '00000000000000000000ffff')) {
                return $this->isPrivateIp(inet_ntop(substr($binary, -4)));
            }
            if (str_starts_with($hex, '2002') || ! in_array($hex[0], ['2', '3'], true)) {
                return true;
            }
        }

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE) === false;
    }
}
