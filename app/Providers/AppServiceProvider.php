<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Sentry\State\Scope;

use function Sentry\configureScope;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Model::preventLazyLoading(! app()->isProduction());

        // Vite prefetch disabled on shared cPanel hosting — the 20+ concurrent
        // <link rel="prefetch"> requests for page chunks (Login, Register,
        // Dashboard, etc.) trip CloudLinux LVE Entry-Process limits and surface
        // as blanket 503s. Only the current page's assets are loaded; other
        // chunks are fetched on demand when the user actually navigates.
        // See: docs/deployment-checklist.md, vite.config.js (locale stub).
        // Vite::prefetch(concurrency: 3);

        RateLimiter::for('chat', function (Request $request) {
            return Limit::perMinute(30)->by($request->user()?->id ?? $request->ip());
        });

        RateLimiter::for('playback', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?? $request->ip());
        });

        // Proxy relay for video range requests: 30/min proved tight for scrubbing
        // (e.g. 5 seeks in 10s → 30/min, plus buffering). Raised to 60/min (1/s)
        // to absorb legitimate bursts while still capping abuse. No prod 429s
        // observed in logs for this limiter; kept at 60 (not 120) to preserve
        // abuse ceiling. Re-evaluate if scrub-heavy E2E shows 429s.
        RateLimiter::for('proxy', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?? $request->ip());
        });

        RateLimiter::for('presence', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?? $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by($request->input('email').'|'.$request->ip());
        });

        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('forgot-password', function (Request $request) {
            return Limit::perMinute(5)->by($request->input('email').'|'.$request->ip());
        });

        RateLimiter::for('reset-password', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('join', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?? $request->ip());
        });

        RateLimiter::for('room-create', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?? $request->ip());
        });

        RateLimiter::for('subtitles', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?? $request->ip());
        });

        // Bind authenticated user to Sentry scope for error context (when DSN configured).
        // Guarded so local dev with dummy DSN still works — no exception if Sentry not booted.
        if (app()->bound('sentry') || config('sentry.dsn')) {
            try {
                configureScope(function (Scope $scope): void {
                    if (auth()->check()) {
                        $user = auth()->user();
                        $scope->setUser([
                            'id' => $user->getAuthIdentifier(),
                            'email' => $user->email ?? null,
                        ]);
                    }
                });
            } catch (\Throwable) {
                // Sentry not configured — silent no-op.
            }
        }
    }
}
