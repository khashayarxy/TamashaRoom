<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cross-tab & background polling session cookie protection.
 *
 * Primary protection against cross-tab session cookie overwrite races:
 * When Tab 2 logs in / regenerates session ID, Tab 1's trailing background polls
 * carrying the old (now destroyed) session ID fail authentication. Without this
 * middleware, StartSession initializes a new empty guest session and returns a
 * `Set-Cookie: laravel_session=ID_EMPTY` header that overwrites the browser's shared
 * cookie jar.
 *
 * This middleware strips/clears the unauthenticated `Set-Cookie` header on XHR/JSON
 * and polling endpoints, ensuring an unauthenticated background poll 401 response
 * NEVER overwrites the browser's cookie jar holding another tab's active session.
 */
class SuppressAnonymousSessionCookie
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (Auth::guest() && ($request->expectsJson() || $request->is('playback/*', 'presence/*', 'chat/*', 'proxy/*'))) {
            $cookieName = (string) config('session.cookie', 'laravel_session');

            // Clear/suppress the session cookie on unauthenticated API/polling responses
            $response->headers->clearCookie($cookieName, '/');
        }

        return $response;
    }
}
