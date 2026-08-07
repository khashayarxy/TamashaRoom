<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // The CSP nonce must be generated and shared BEFORE the view renders,
        // so inline scripts emitted during rendering (Ziggy's @routes, Vite)
        // can carry the same nonce. Vite's assets are the app entry point.
        $nonce = app()->environment('local') ? null : base64_encode(random_bytes(16));

        if ($nonce !== null) {
            view()->share('cspNonce', $nonce);
            Vite::useCspNonce($nonce);
        }

        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'DENY', true);
        $response->headers->set('X-Content-Type-Options', 'nosniff', true);
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin', true);

        $permissions = implode(', ', [
            'accelerometer=()',
            'autoplay=(self)',
            'camera=()',
            'display-capture=()',
            'encrypted-media=()',
            'fullscreen=(self)',
            'geolocation=()',
            'gyroscope=()',
            'magnetometer=()',
            'microphone=()',
            'midi=()',
            'payment=()',
            'picture-in-picture=()',
            'publickey-credentials-get=()',
            'screen-wake-lock=()',
            'sync-xhr=()',
            'usb=()',
            'web-share=()',
            'xr-spatial-tracking=()',
        ]);
        $response->headers->set('Permissions-Policy', $permissions, true);

        // The client-side Echo instance (resources/js/lib/echo.ts) dials
        // wss://ws-{cluster}.pusher.com (or a custom VITE_PUSHER_HOST for a
        // future Reverb endpoint) when BROADCAST_CONNECTION=pusher. connect-src
        // must allow that WebSocket origin or push never connects and the room
        // hooks silently fall back to nothing. Only emitted when the pusher
        // driver is actually active.
        $pusherOrigin = $this->pusherWebSocketOrigin();

        if (app()->environment('local')) {
            $viteDevOrigin = 'http://127.0.0.1:5173';
            $viteDevWs = 'ws://127.0.0.1:5173';

            $csp = "default-src 'self'; "
                ."script-src 'self' 'unsafe-inline' {$viteDevOrigin}; "
                ."style-src 'self' 'unsafe-inline' {$viteDevOrigin}; "
                ."img-src 'self' data: blob: https:; "
                ."font-src 'self' data:; "
                ."connect-src 'self' https: {$viteDevOrigin} {$viteDevWs}"
                .($pusherOrigin !== null ? " {$pusherOrigin}" : '').'; '
                ."media-src 'self' https:; "
                ."frame-src 'none'; "
                ."object-src 'none'; "
                ."base-uri 'self'; "
                ."form-action 'self'";
        } else {
            $csp = "default-src 'self'; "
                ."script-src 'self' 'nonce-{$nonce}'; "
                ."style-src 'self' 'unsafe-inline'; "
                ."img-src 'self' data: blob: https:; "
                ."font-src 'self' data:; "
                ."connect-src 'self' https:"
                .($pusherOrigin !== null ? " {$pusherOrigin}" : '').'; '
                ."media-src 'self' https:; "
                ."frame-src 'none'; "
                ."object-src 'none'; "
                ."base-uri 'self'; "
                ."form-action 'self'";
        }

        $response->headers->set('Content-Security-Policy', $csp, true);

        if (app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains', true);
        }

        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }

    /**
     * The WebSocket origin the Echo client dials when the pusher driver is
     * active. Mirrors resources/js/lib/echo.ts: PUSHER_HOST (VITE_PUSHER_HOST
     * client-side) overrides the default ws-{cluster}.pusher.com, and
     * PUSHER_SCHEME decides ws:// vs wss://. The cluster is read from the
     * resolved broadcast config so an empty PUSHER_APP_CLUSTER degrades to the
     * mt1 default instead of emitting a broken "ws-.pusher.com" origin, and
     * tests can pin it via config(). PUSHER_HOST/PUSHER_SCHEME stay raw env —
     * the driver's `host` option is the REST API host (api-*.pusher.com),
     * which is NOT the WebSocket host. Null when broadcasting is not pusher,
     * so the CSP stays as tight as ever.
     */
    private function pusherWebSocketOrigin(): ?string
    {
        if (config('broadcasting.default') !== 'pusher') {
            return null;
        }

        $cluster = (string) (config('broadcasting.connections.pusher.options.cluster') ?: 'mt1');
        $host = (string) env('PUSHER_HOST', '');
        $scheme = (string) env('PUSHER_SCHEME', 'https');

        $host = $host !== '' ? $host : 'ws-'.$cluster.'.pusher.com';

        return ($scheme === 'https' ? 'wss://' : 'ws://').$host;
    }
}
