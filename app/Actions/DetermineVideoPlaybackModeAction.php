<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\PlaybackMode;
use App\Services\UrlSecurityService;
use Illuminate\Support\Facades\Http;

class DetermineVideoPlaybackModeAction
{
    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
    ) {}

    public function execute(string $url): PlaybackMode
    {
        $error = $this->urlSecurity->validateVideoUrl($url);

        if ($error !== null) {
            return PlaybackMode::Proxy;
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
        } catch (\Throwable) {
            return PlaybackMode::Proxy;
        }
    }
}
