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

        if (app()->environment('local')) {
            $viteDevOrigin = 'http://127.0.0.1:5173';
            $viteDevWs = 'ws://127.0.0.1:5173';

            $csp = "default-src 'self'; "
                ."script-src 'self' 'unsafe-inline' {$viteDevOrigin}; "
                ."style-src 'self' 'unsafe-inline' {$viteDevOrigin}; "
                ."img-src 'self' data: blob: https:; "
                ."font-src 'self' data:; "
                ."connect-src 'self' https: {$viteDevOrigin} {$viteDevWs}; "
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
                ."connect-src 'self' https:; "
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
}
