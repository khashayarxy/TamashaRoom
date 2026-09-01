<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HttpRetryService
{
    /**
     * Perform a GET with exponential backoff retry.
     */
    public function get(string $url, array $options = [], int $retries = 3, int $delayMs = 500): Response
    {
        for ($attempt = 1; $attempt <= $retries; $attempt++) {
            try {
                return Http::timeout(10)->get($url, $options);
            } catch (\Throwable $e) {
                if ($attempt === $retries) {
                    report($e);
                    Log::warning('HttpRetryService: all retries exhausted', [
                        'url' => $url,
                        'attempts' => $retries,
                        'error' => $e->getMessage(),
                    ]);
                    throw $e;
                }

                usleep($delayMs * 1000 * $attempt);
            }
        }

        // @phpstan-ignore deadCode.unreachable
        throw new \RuntimeException('Unreachable retry loop');
    }

    /**
     * Perform a HEAD with exponential backoff retry.
     */
    public function head(string $url, int $retries = 3, int $delayMs = 500): Response
    {
        for ($attempt = 1; $attempt <= $retries; $attempt++) {
            try {
                return Http::withoutRedirecting()->timeout(3)->head($url);
            } catch (\Throwable $e) {
                if ($attempt === $retries) {
                    report($e);
                    Log::warning('HttpRetryService: HEAD retries exhausted', [
                        'url' => $url,
                        'attempts' => $retries,
                        'error' => $e->getMessage(),
                    ]);
                    throw $e;
                }

                usleep($delayMs * 1000 * $attempt);
            }
        }

        throw new \RuntimeException('Unreachable retry loop');
    }
}
