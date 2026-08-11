<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\RoomRequestDiagnosticsService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Observability for room-scoped endpoints (playback sync and the video proxy).
 * Captures rendered >= 400 responses (validation, authorization, proxy
 * upstream/range failures) with full request context via
 * RoomRequestDiagnosticsService. Exception-driven failures — most importantly
 * the 429 thrown by the throttle middleware, which runs OUTER to this
 * middleware — are captured by the exception handler's render callback
 * (bootstrap/app.php); the two paths never double-record.
 */
class DiagnoseRoomRequest
{
    public function __construct(
        private readonly RoomRequestDiagnosticsService $diagnostics,
    ) {}

    /**
     * @param  'playback'|'proxy'|null  $category  matches the named rate limiter used on the route
     */
    public function handle(Request $request, Closure $next, ?string $category = null): Response
    {
        $response = $next($request);

        if ($response->getStatusCode() >= 400) {
            $this->diagnostics->record(
                $request,
                $category ?? 'room',
                $response->getStatusCode(),
                rateLimited: false,
            );
        }

        return $response;
    }
}
