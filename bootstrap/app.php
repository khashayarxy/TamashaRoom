<?php

use App\Exceptions\VideoUrlValidationException;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeadersMiddleware;
use App\Http\Middleware\SuppressAnonymousSessionCookie;
use App\Models\ChatMessage;
use App\Models\Room;
use App\Policies\ChatMessagePolicy;
use App\Policies\RoomPolicy;
use App\Services\RoomRequestDiagnosticsService;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function () {
            if (app()->environment('local', 'testing')) {
                Route::middleware('web')
                    ->group(base_path('routes/test-helpers.php'));
            }
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(prepend: [
            SuppressAnonymousSessionCookie::class,
        ]);
        $middleware->web(append: [
            SecurityHeadersMiddleware::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->encryptCookies(except: [
            'XSRF-TOKEN',
        ]);

        $middleware->validateCsrfTokens(except: [
            '__test/*',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (VideoUrlValidationException $e, Request $request) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 422);
        });

        // Room-request diagnostics: record exception-driven failures on playback
        // sync and the video proxy (most importantly the throttle's 429, which is
        // thrown OUTER to DiagnoseRoomRequest). Returns null so Laravel's own
        // rendering is never altered.
        $exceptions->render(function (Throwable $e, Request $request) {
            $route = $request->route();

            if ($route === null) {
                return null;
            }

            $category = RoomRequestDiagnosticsService::categoryForRoute($route->getName() ?? '');

            if ($category === null) {
                return null;
            }

            $status = match (true) {
                $e instanceof HttpExceptionInterface => $e->getStatusCode(),
                $e instanceof ValidationException => 422,
                default => 500,
            };

            app(RoomRequestDiagnosticsService::class)->record(
                $request,
                $category,
                $status,
                rateLimited: $e instanceof ThrottleRequestsException,
                limiterName: $e instanceof ThrottleRequestsException ? $category : null,
            );

            return null;
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->expectsJson() && config('app.debug') === false && ! ($e instanceof HttpExceptionInterface)) {
                return response()->json([
                    'message' => 'Server Error',
                ], 500);
            }
        });
    })
    ->withProviders([
        // Policies are auto-discovered by convention, but registered explicitly for clarity.
    ])->create();

Gate::policy(Room::class, RoomPolicy::class);
Gate::policy(ChatMessage::class, ChatMessagePolicy::class);
