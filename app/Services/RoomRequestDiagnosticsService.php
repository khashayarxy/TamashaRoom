<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Room;
use Illuminate\Cache\RateLimiter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Sentry\Breadcrumb;

/**
 * Structured observability for failed room-scoped requests (playback sync and
 * the video proxy). Every failure writes a grep-able log line and, when a DSN
 * is configured, a Sentry HTTP breadcrumb so transient S3/S4-class failures can
 * be correlated post-hoc. It never changes the response.
 */
class RoomRequestDiagnosticsService
{
    public function __construct(
        private readonly RateLimiter $rateLimiter,
    ) {}

    /**
     * Map a route name to its diagnostics category ('playback' or 'proxy');
     * the category doubles as the name of the rate limiter behind a 429 on
     * that route. Returns null for non-target routes.
     */
    public static function categoryForRoute(string $routeName): ?string
    {
        if (str_starts_with($routeName, 'playback.')) {
            return 'playback';
        }

        if ($routeName === 'proxy.video') {
            return 'proxy';
        }

        return null;
    }

    /**
     * @param  'playback'|'proxy'  $category
     * @param  string|null  $limiterName  the named rate limiter behind a 429
     */
    public function record(
        Request $request,
        string $category,
        int $status,
        bool $rateLimited,
        ?string $limiterName = null,
    ): void {
        $context = $this->buildContext($request, $category, $status, $rateLimited, $limiterName);

        $message = "[diagnostics:{$category}] {$context['method']} {$context['path']} → HTTP {$status} ({$context['failure_type']})";

        if ($status >= 500) {
            Log::error($message, $context);
        } else {
            Log::warning($message, $context);
        }

        $this->addSentryBreadcrumb($category, $context);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildContext(
        Request $request,
        string $category,
        int $status,
        bool $rateLimited,
        ?string $limiterName,
    ): array {
        $room = $request->route('room');
        $roomId = $room instanceof Room ? $room->id : $room;

        $context = [
            'endpoint' => $request->route()?->getName() ?? $request->method().' /'.$request->path(),
            'method' => $request->method(),
            'path' => '/'.$request->path(),
            'http_status' => $status,
            'room_id' => $roomId,
            'timestamp' => now()->toIso8601String(),
            'rate_limited' => $rateLimited,
            'failure_type' => $this->classify($status),
            'user_id' => $request->user()?->id,
        ];

        if ($rateLimited) {
            $context = array_merge($context, $this->limiterContext($request, $limiterName));
        }

        return $context;
    }

    private function classify(int $status): string
    {
        return match (true) {
            $status === 429 => 'rate_limit',
            $status === 422 => 'validation',
            $status === 403 => 'forbidden',
            $status === 404 => 'not_found',
            in_array($status, [502, 504], true) => 'upstream',
            $status >= 500 => 'server_error',
            default => 'client_error',
        };
    }

    /**
     * Capture which named limiter rejected the request and how many attempts it
     * has burned, so a 429 is traceable to a specific threshold. The cache key
     * mirrors ThrottleRequests exactly: md5(limiterName . by-key) with
     * shouldHashKeys = true (vendor/.../ThrottleRequests.php:134).
     *
     * @return array<string, mixed>
     */
    private function limiterContext(Request $request, ?string $limiterName): array
    {
        if ($limiterName === null) {
            return [
                'limiter' => null,
                'limiter_limit' => null,
                'limiter_current_count' => null,
                'retry_after_seconds' => null,
            ];
        }

        $maxAttempts = null;
        $limiter = $this->rateLimiter->limiter($limiterName);

        if ($limiter !== null) {
            $result = $limiter($request);
            $maxAttempts = $result instanceof Limit ? $result->maxAttempts : null;
        }

        // By-key the same way AppServiceProvider registers these limiters
        // (user id when authenticated, IP otherwise).
        $baseKey = (string) ($request->user()?->id ?? $request->ip());
        $key = md5($limiterName.$baseKey);

        return [
            'limiter' => $limiterName,
            'limiter_limit' => $maxAttempts,
            'limiter_current_count' => $this->rateLimiter->attempts($key),
            'retry_after_seconds' => $this->rateLimiter->availableIn($key),
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function addSentryBreadcrumb(string $category, array $context): void
    {
        if (! filled(config('sentry.dsn'))) {
            return;
        }

        \Sentry\addBreadcrumb(
            category: $category === 'playback' ? 'playback-sync' : 'video-proxy',
            message: "HTTP {$context['http_status']} on {$context['endpoint']}",
            metadata: $context,
            level: $context['http_status'] >= 500 ? Breadcrumb::LEVEL_ERROR : Breadcrumb::LEVEL_WARNING,
            type: Breadcrumb::TYPE_HTTP,
        );
    }
}
