<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeadersMiddleware;
use App\Models\ChatMessage;
use App\Models\Room;
use App\Policies\ChatMessagePolicy;
use App\Policies\RoomPolicy;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
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
