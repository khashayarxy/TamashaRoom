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
 * Live-room endpoints never change session identity. A delayed poll or leave
 * beacon can finish after a new login, even if it authenticated before that
 * login. Neither its old session cookie nor a replacement guest cookie should
 * overwrite the browser's new identity. Login/logout and room joins keep their
 * normal session-cookie lifecycle.
 */
class SuppressAnonymousSessionCookie
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $isRoomBackgroundRequest = $request->is('playback/*', 'presence/*', 'chat/*', 'proxy/*');
        $isAnonymousJsonRead = Auth::guest() && $request->expectsJson() && $request->isMethod('GET');

        if ($isRoomBackgroundRequest || $isAnonymousJsonRead) {
            $cookieName = (string) config('session.cookie', 'laravel_session');

            // An expired cookie would also overwrite another tab's authenticated cookie.
            foreach ($response->headers->getCookies() as $cookie) {
                if ($cookie->getName() === $cookieName || ($isRoomBackgroundRequest && $cookie->getName() === 'XSRF-TOKEN')) {
                    $response->headers->removeCookie($cookie->getName(), $cookie->getPath(), $cookie->getDomain());
                }
            }
        }

        return $response;
    }
}
