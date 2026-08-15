<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class VideoProxyService
{
    private const CHUNK_SIZE = 8192;

    private const CONNECT_TIMEOUT = 15;

    private const READ_TIMEOUT = 30;

    private const MAX_REDIRECTS = 5;

    private const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024;

    private const MIME_MAP = [
        'mp4' => 'video/mp4',
        'webm' => 'video/webm',
        'ogg' => 'video/ogg',
        'mkv' => 'video/x-matroska',
        'mov' => 'video/quicktime',
        'avi' => 'video/x-msvideo',
        'm3u8' => 'application/vnd.apple.mpegurl',
        'ts' => 'video/mp2t',
    ];

    /**
     * The HTTP status code of the most recent upstream stream open.
     */
    protected ?int $lastStreamStatus = null;

    /**
     * The raw response headers of the most recent upstream stream open.
     *
     * @var array<string|int, mixed>
     */
    protected array $lastStreamHeaders = [];

    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
    ) {}

    public function stream(Request $request, string $videoUrl): Response
    {
        $error = $this->urlSecurity->validateVideoUrl($videoUrl);

        if ($error !== null) {
            return $this->errorResponse('Video source rejected.', 400);
        }

        $rangeHeader = $request->header('Range');

        if ($rangeHeader !== null && ! $this->isValidRangeFormat($rangeHeader)) {
            return $this->errorResponse('Invalid Range header format.', 400);
        }

        $headInfo = $this->fetchHead($videoUrl);

        if ($headInfo === null) {
            // Single bounded retry: edge CDNs (and the shared-hosting budget)
            // hiccup intermittently. One immediate retry turns a transient probe
            // failure into a working stream instead of a 502 data source error.
            $headInfo = $this->fetchHead($videoUrl);
        }

        if ($headInfo === null) {
            return $this->errorResponse('Failed to reach video source.', 502);
        }

        $finalUrl = $headInfo['url'];
        $contentType = $this->detectContentType($headInfo['content_type'] ?? '', $finalUrl);
        $contentLength = $headInfo['content_length'] ?? null;
        $acceptRanges = $headInfo['accept_ranges'] ?? false;

        // Fix for Root Cause A: Always forward Range requests whenever the browser sends
        // a Range header (e.g. bytes=0-), regardless of whether the upstream explicit HEAD
        // probe returned Accept-Ranges: bytes.
        if ($rangeHeader !== null) {
            return $this->handleRangeRequest($finalUrl, $rangeHeader, $contentType, $contentLength);
        }

        return $this->handleFullRequest($finalUrl, $contentType, $acceptRanges);
    }

    private function fetchHead(string $url): ?array
    {
        $current = $url;
        $visited = [];

        for ($hop = 0; $hop < self::MAX_REDIRECTS; $hop++) {
            $error = $this->urlSecurity->validateVideoUrl($current);

            if ($error !== null) {
                return null;
            }

            if (isset($visited[$current])) {
                return null;
            }

            $visited[$current] = true;

            $context = $this->createStreamContext([
                'User-Agent: TamashaRoom/1.0',
            ], self::CONNECT_TIMEOUT);

            $headers = $this->httpGetHeaders($current, $context);

            if ($headers === false) {
                return null;
            }

            $statusCode = $this->extractStatusCode($headers);

            if ($statusCode === null || $statusCode < 200 || $statusCode >= 400) {
                return null;
            }

            if ($statusCode >= 300 && $statusCode < 400) {
                $location = $this->extractHeaderValue($headers, 'Location');

                if ($location === null) {
                    return null;
                }

                $current = $this->resolveRelativeUrl($current, $location);

                if ($current === null) {
                    return null;
                }

                continue;
            }

            $contentLength = $this->extractContentLength($headers);

            if ($contentLength !== null && $contentLength > self::MAX_FILE_SIZE) {
                return null;
            }

            return [
                'url' => $current,
                'content_type' => $this->extractHeaderValue($headers, 'Content-Type'),
                'content_length' => $contentLength,
                'accept_ranges' => $this->hasAcceptRanges($headers),
                'status_code' => $statusCode,
            ];
        }

        return null;
    }

    private function createStreamContext(array $headers, int $timeout = self::READ_TIMEOUT)
    {
        return stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => $timeout,
                'follow_location' => 0,
                'max_redirects' => 0,
                'header' => $headers,
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);
    }

    private function extractStatusCode(array $headers): ?int
    {
        $first = $headers[0] ?? null;

        if (! is_string($first)) {
            return null;
        }

        preg_match('/\d{3}/', $first, $matches);

        return isset($matches[0]) ? (int) $matches[0] : null;
    }

    private function extractHeaderValue(array $headers, string $name): ?string
    {
        $nameLower = strtolower($name);
        $value = null;

        // PHP's get_headers returns an associative array where keys can be the original case.
        // We need to iterate to find the case-insensitive match.
        foreach ($headers as $key => $val) {
            if (is_string($key) && strtolower($key) === $nameLower) {
                $value = $val;
                break;
            }
        }

        if (is_array($value)) {
            $value = end($value);
        }

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function extractContentLength(array $headers): ?int
    {
        $value = $this->extractHeaderValue($headers, 'Content-Length');

        if ($value === null || ! is_numeric($value)) {
            return null;
        }

        return (int) $value;
    }

    private function hasAcceptRanges(array $headers): bool
    {
        $value = $this->extractHeaderValue($headers, 'Accept-Ranges');

        return $value !== null && strtolower($value) === 'bytes';
    }

    private function resolveRelativeUrl(string $base, string $location): ?string
    {
        if (preg_match('/^https?:\/\//i', $location)) {
            return $location;
        }

        $parts = parse_url($base);

        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        $scheme = $parts['scheme'];
        $host = $parts['host'];
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        if (str_starts_with($location, '//')) {
            return $scheme.':'.$location;
        }

        if (str_starts_with($location, '/')) {
            return $scheme.'://'.$host.$port.$location;
        }

        $path = $parts['path'] ?? '/';

        $lastSlash = strrpos($path, '/');

        $basePath = $lastSlash !== false ? substr($path, 0, $lastSlash + 1) : '/';

        return $scheme.'://'.$host.$port.$basePath.$location;
    }

    private function detectContentType(?string $remoteType, string $url): string
    {
        if ($remoteType !== null && $remoteType !== '' && $remoteType !== 'application/octet-stream' && ! str_contains($remoteType, 'text/html')) {
            return $remoteType;
        }

        $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION));

        return self::MIME_MAP[$extension] ?? 'video/mp4';
    }

    private function handleRangeRequest(string $url, string $rangeHeader, string $contentType, ?int $contentLength): Response
    {
        if (! $this->isValidRangeFormat($rangeHeader)) {
            return $this->errorResponse('Invalid Range header.', 416);
        }

        preg_match('/^bytes=(\d*)-(\d*)$/', $rangeHeader, $matches);

        $specifiedStart = $matches[1] !== '' ? (int) $matches[1] : null;
        $specifiedEnd = $matches[2] !== '' ? (int) $matches[2] : null;

        // Suffix range: `bytes=-500` means "the last 500 bytes".
        if ($specifiedStart === null && $specifiedEnd !== null) {
            if ($contentLength === null) {
                return $this->errorResponse('Range not satisfiable.', 416);
            }

            $start = max(0, $contentLength - $specifiedEnd);
            $end = $contentLength - 1;

            if ($contentLength === 0) {
                return $this->errorResponse('Range not satisfiable.', 416);
            }
        } else {
            $start = $specifiedStart ?? 0;
            $end = $specifiedEnd ?? ($contentLength !== null ? $contentLength - 1 : null);
        }

        if ($contentLength !== null && $start >= $contentLength) {
            return $this->errorResponse('Range not satisfiable.', 416);
        }

        if ($end !== null && $contentLength !== null && $end >= $contentLength) {
            $end = $contentLength - 1;
        }

        // Reject inverted ranges (start > end).
        if ($end !== null && $start > $end) {
            return $this->errorResponse('Range not satisfiable.', 416);
        }

        $context = $this->createStreamContext([
            'User-Agent: TamashaRoom/1.0',
            "Range: bytes={$start}-".($end !== null ? $end : ''),
        ]);

        $opened = $this->openStreamFollowingRedirects($url, $context);

        if ($opened === false) {
            return $this->errorResponse('Failed to open video stream.', 502);
        }

        $stream = $opened['stream'];

        // If the origin ignored our Range header and returned the full body
        // (HTTP 200), fall through to full-stream semantics rather than
        // synthesizing an incorrect 206/Content-Range.
        if ($opened['status'] === 200) {
            return $this->buildFullStreamResponse($stream, $contentType, true);
        }

        // Only a 206 is valid for a range request. Anything else (4xx/5xx, or a
        // redirect that could not be resolved) is an upstream failure — never
        // relay the error body as video bytes.
        if ($opened['status'] !== 206) {
            fclose($stream);

            return $this->errorResponse('Upstream range request failed.', 502);
        }

        // Prefer the upstream's actual Content-Range/Content-Length so the bytes
        // we relay always match the headers the browser sees. A mismatch here
        // (e.g. an edge that clamps or re-serves the range) surfaces as a
        // mid-seek MEDIA_ELEMENT_ERROR: Format error.
        $upstreamContentRange = $this->extractHeaderValue($opened['headers'], 'Content-Range');
        $responseContentLength = null;
        $contentRange = null;

        if ($upstreamContentRange !== null
            && preg_match('/^bytes (\d+)-(\d+)\/(\d+|\*)$/', $upstreamContentRange, $matches)) {
            $contentRange = $upstreamContentRange;
            $responseContentLength = (int) $matches[2] - (int) $matches[1] + 1;
        } else {
            $responseContentLength = $end !== null ? $end - $start + 1 : ($contentLength !== null ? $contentLength - $start : null);
            $contentRange = "bytes {$start}-".($end ?? ($contentLength !== null ? $contentLength - 1 : '*')).'/'.($contentLength ?? '*');
        }

        $response = response()->stream(function () use ($stream): void {
            $this->streamChunks($stream);
        }, 206, [
            'Content-Type' => $contentType,
            'Content-Range' => $contentRange,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'no-cache, private',
            'X-Proxy' => 'TamashaRoom/1.0',
        ]);

        if ($responseContentLength !== null) {
            $response->headers->set('Content-Length', (string) $responseContentLength);
        }

        return $response;
    }

    private function handleFullRequest(string $url, string $contentType, bool $acceptRanges): Response
    {
        $context = $this->createStreamContext([
            'User-Agent: TamashaRoom/1.0',
        ]);

        $opened = $this->openStreamFollowingRedirects($url, $context);

        if ($opened === false) {
            return $this->errorResponse('Failed to open video stream.', 502);
        }

        // Redirects are followed by openStreamFollowingRedirects, so only 2xx
        // responses are expected here. Reject anything else rather than relaying
        // an upstream error body as video.
        if ($opened['status'] === null || $opened['status'] >= 300) {
            fclose($opened['stream']);

            return $this->errorResponse('Failed to open video stream.', 502);
        }

        return $this->buildFullStreamResponse($opened['stream'], $contentType, $acceptRanges);
    }

    private function buildFullStreamResponse($stream, string $contentType, bool $acceptRanges): Response
    {
        $headers = [
            'Content-Type' => $contentType,
            'Cache-Control' => 'no-cache, private',
            'X-Proxy' => 'TamashaRoom/1.0',
        ];

        if ($acceptRanges) {
            $headers['Accept-Ranges'] = 'bytes';
        }

        return response()->stream(function () use ($stream): void {
            $this->streamChunks($stream);
        }, 200, $headers);
    }

    private function streamChunks($stream): void
    {
        if (! is_resource($stream)) {
            return;
        }

        $relayed = 0;

        while (! feof($stream)) {
            $this->resetTimeLimit();

            $chunk = fread($stream, self::CHUNK_SIZE);

            if ($chunk === false) {
                break;
            }

            $relayed += strlen($chunk);

            if ($relayed > $this->maxRelayedBytes()) {
                break;
            }

            echo $chunk;

            flush();

            if (connection_aborted()) {
                break;
            }
        }

        fclose($stream);
    }

    protected function maxRelayedBytes(): int
    {
        return self::MAX_FILE_SIZE;
    }

    /**
     * Reset PHP's execution-time budget. Called on every relayed chunk so a
     * long stream is not truncated by max_execution_time partway through.
     * A testable seam: subclasses can observe these calls without a real
     * 35s+ relay. Where set_time_limit() is disabled via disable_functions
     * this is a no-op and the ini max_execution_time applies instead — see
     * the deployment checklist note about raising it on shared hosts.
     */
    protected function resetTimeLimit(): void
    {
        set_time_limit(0);
    }

    /**
     * Open the upstream stream, following any redirect the final URL returns.
     * Edge CDNs rotate nodes between the fetchHead probe and the actual stream
     * open, so the URL we open here can itself answer with a 3xx even though the
     * probe resolved it. Redirect hops are validated per-hop for SSRF, mirroring
     * fetchHead. Returns the opened stream plus its final status and response
     * headers, or false when the chain cannot be resolved.
     *
     * @return array{stream: resource, status: int|null, headers: array<string|int, mixed>}|false
     */
    private function openStreamFollowingRedirects(string $url, mixed $context): array|false
    {
        $current = $url;
        $visited = [];

        for ($hop = 0; $hop < self::MAX_REDIRECTS; $hop++) {
            $error = $this->urlSecurity->validateVideoUrl($current);

            if ($error !== null) {
                return false;
            }

            if (isset($visited[$current])) {
                return false;
            }

            $visited[$current] = true;

            $stream = $this->openRemoteStream($current, $context);

            if ($stream === false) {
                return false;
            }

            $status = $this->lastStreamStatus;

            if ($status === null || $status < 300 || $status >= 400) {
                return [
                    'stream' => $stream,
                    'status' => $status,
                    'headers' => $this->lastStreamHeaders,
                ];
            }

            $location = $this->extractHeaderValue($this->lastStreamHeaders, 'Location');
            fclose($stream);

            if ($location === null) {
                return false;
            }

            $resolved = $this->resolveRelativeUrl($current, $location);

            if ($resolved === null) {
                return false;
            }

            $current = $resolved;
        }

        return false;
    }

    /**
     * Overridable seam for tests: fetch response headers for a URL without
     * following redirects. Defaults to PHP's get_headers over the provided
     * stream context. Tests substitute a fake to avoid real network I/O.
     *
     * @return array<string|int, mixed>|false
     */
    protected function httpGetHeaders(string $url, mixed $context): array|false
    {
        return @get_headers($url, true, $context);
    }

    /**
     * Overridable seam for the range/full stream open. Defaults to fopen with
     * the provided stream context; tests substitute a memory stream. Captures
     * the upstream HTTP status and response headers from $http_response_header
     * for later use.
     */
    protected function openRemoteStream(string $url, mixed $context)
    {
        $stream = @fopen($url, 'r', false, $context);

        $headers = $http_response_header ?? [];

        $this->lastStreamStatus = $this->extractStatusCode($headers);
        $this->lastStreamHeaders = $headers;

        return $stream;
    }

    private function errorResponse(string $message, int $statusCode): Response
    {
        Log::warning('VideoProxy error', [
            'status' => $statusCode,
            'message' => $message,
        ]);

        // Fix for Root Cause B: Never return application/json or JSON body to the <video>
        // element. On upstream failure, return an empty body stream with video/mp4 Content-Type
        // and appropriate HTTP error status (502, 404, 400, 416) so the browser's native media
        // engine processes the HTTP error status without throwing a JSON decoding crash.
        return response()->stream(function (): void {}, $statusCode, [
            'Content-Type' => 'video/mp4',
            'X-Proxy-Error' => $message,
        ]);
    }

    private function isValidRangeFormat(string $range): bool
    {
        return (bool) preg_match('/^bytes=\d*-\d*$/', $range);
    }
}
