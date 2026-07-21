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
            return $this->errorResponse('Failed to reach video source.', 502);
        }

        $contentType = $this->detectContentType($headInfo['content_type'] ?? '', $videoUrl);
        $contentLength = $headInfo['content_length'] ?? null;
        $acceptRanges = $headInfo['accept_ranges'] ?? false;

        if ($rangeHeader !== null && $acceptRanges) {
            return $this->handleRangeRequest($videoUrl, $rangeHeader, $contentType, $contentLength);
        }

        return $this->handleFullRequest($videoUrl, $contentType);
    }

    private function fetchHead(string $url): ?array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => self::CONNECT_TIMEOUT,
                'follow_location' => 1,
                'max_redirects' => 5,
                'header' => "User-Agent: TamashaRoom/1.0\r\n",
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $headers = @get_headers($url, true, $context);

        if ($headers === false) {
            return null;
        }

        $statusCode = 0;

        if (isset($headers[0]) && is_string($headers[0])) {
            preg_match('/\d{3}/', $headers[0], $matches);
            $statusCode = (int) ($matches[0] ?? 0);
        }

        if ($statusCode < 200 || $statusCode >= 400) {
            return null;
        }

        $contentType = null;

        if (isset($headers['Content-Type'])) {
            $contentType = is_array($headers['Content-Type'])
                ? end($headers['Content-Type'])
                : $headers['Content-Type'];
        }

        $contentLength = null;

        if (isset($headers['Content-Length'])) {
            $contentLength = (int) (is_array($headers['Content-Length'])
                ? end($headers['Content-Length'])
                : $headers['Content-Length']);
        }

        if ($contentLength !== null && $contentLength > self::MAX_FILE_SIZE) {
            return null;
        }

        $acceptRanges = false;

        if (isset($headers['Accept-Ranges'])) {
            $acceptRangesValue = is_array($headers['Accept-Ranges'])
                ? end($headers['Accept-Ranges'])
                : $headers['Accept-Ranges'];
            $acceptRanges = strtolower($acceptRangesValue) === 'bytes';
        }

        return [
            'content_type' => $contentType,
            'content_length' => $contentLength,
            'accept_ranges' => $acceptRanges,
            'status_code' => $statusCode,
        ];
    }

    private function detectContentType(?string $remoteType, string $url): string
    {
        if ($remoteType !== null && $remoteType !== '' && $remoteType !== 'application/octet-stream') {
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

        $start = $matches[1] !== '' ? (int) $matches[1] : 0;
        $end = $matches[2] !== '' ? (int) $matches[2] : ($contentLength !== null ? $contentLength - 1 : null);

        if ($contentLength !== null && $start >= $contentLength) {
            return $this->errorResponse('Range not satisfiable.', 416);
        }

        if ($end !== null && $contentLength !== null && $end >= $contentLength) {
            $end = $contentLength - 1;
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => self::READ_TIMEOUT,
                'follow_location' => 1,
                'max_redirects' => 5,
                'header' => [
                    'User-Agent: TamashaRoom/1.0',
                    "Range: bytes={$start}-".($end !== null ? $end : ''),
                ],
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $stream = @fopen($url, 'r', false, $context);

        if ($stream === false) {
            return $this->errorResponse('Failed to open video stream.', 502);
        }

        $responseContentLength = $end !== null ? $end - $start + 1 : ($contentLength !== null ? $contentLength - $start : null);
        $contentRange = "bytes {$start}-".($end ?? ($contentLength !== null ? $contentLength - 1 : '*')).'/'.($contentLength ?? '*');

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
            $response->header('Content-Length', (string) $responseContentLength);
        }

        return $response;
    }

    private function handleFullRequest(string $url, string $contentType): Response
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => self::READ_TIMEOUT,
                'follow_location' => 1,
                'max_redirects' => 5,
                'header' => "User-Agent: TamashaRoom/1.0\r\n",
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $stream = @fopen($url, 'r', false, $context);

        if ($stream === false) {
            return $this->errorResponse('Failed to open video stream.', 502);
        }

        return response()->stream(function () use ($stream): void {
            $this->streamChunks($stream);
        }, 200, [
            'Content-Type' => $contentType,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'no-cache, private',
            'X-Proxy' => 'TamashaRoom/1.0',
        ]);
    }

    private function streamChunks($stream): void
    {
        if (! is_resource($stream)) {
            return;
        }

        set_time_limit(self::READ_TIMEOUT + 5);

        while (! feof($stream)) {
            $chunk = fread($stream, self::CHUNK_SIZE);

            if ($chunk === false) {
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

    private function errorResponse(string $message, int $statusCode): Response
    {
        Log::warning('VideoProxy error', [
            'status' => $statusCode,
            'message' => $message,
        ]);

        return response()->stream(function () use ($message): void {
            echo json_encode(['error' => $message]);
        }, $statusCode, [
            'Content-Type' => 'application/json',
        ]);
    }

    private function isValidRangeFormat(string $range): bool
    {
        return (bool) preg_match('/^bytes=\d*-\d*$/', $range);
    }
}
