<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlaybackMode;
use App\Exceptions\VideoUrlValidationException;
use App\Services\UrlSecurityService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DetermineVideoPlaybackModeAction
{
    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
    ) {}

    public function execute(string $url): PlaybackMode
    {
        $error = $this->urlSecurity->validateVideoUrl($url);

        if ($error !== null) {
            throw new VideoUrlValidationException($error);
        }

        try {
            $response = Http::withoutRedirecting()
                ->timeout(3)
                ->head($url);

            if (! $response->successful()) {
                return PlaybackMode::Proxy;
            }

            $origin = $response->header('Access-Control-Allow-Origin');
            $corsOk = $origin === '*'
                || $origin === config('app.url')
                || $origin === rtrim(config('app.url'), '/');

            $rangeOk = $response->header('Accept-Ranges') === 'bytes';

            return $corsOk && $rangeOk ? PlaybackMode::Direct : PlaybackMode::Proxy;
        } catch (\Throwable $e) {
            // Falling back to proxy is correct behavior, but a HEAD-probe
            // failure (DNS, TLS, timeout) must be visible in the log —
            // otherwise every direct-mode regression looks like a deliberate
            // proxy choice.
            Log::warning('[playback-mode] HEAD probe failed; falling back to proxy', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            return PlaybackMode::Proxy;
        }
    }
}
