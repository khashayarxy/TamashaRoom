<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class HealthCheckController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'cache' => $this->checkCache(),
            'storage' => $this->checkStorage(),
            // OPcache is the main performance lever on shared hosting (no
            // Redis, single core). A `false` here degrades the endpoint so
            // monitoring notices a host without bytecode caching.
            'opcache' => $this->checkOpcache(),
        ];

        $healthy = ! in_array(false, $checks, true);

        return response()->json([
            'status' => $healthy ? 'ok' : 'degraded',
            'checks' => $checks,
            'timestamp' => now()->toISOString(),
        ], $healthy ? 200 : 503);
    }

    private function checkDatabase(): bool
    {
        try {
            DB::select('select 1');

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function checkCache(): bool
    {
        try {
            $key = 'health_check_'.uniqid('', true);
            Cache::put($key, 'ok', 10);
            $value = Cache::get($key);
            Cache::forget($key);

            return $value === 'ok';
        } catch (\Throwable) {
            return false;
        }
    }

    private function checkStorage(): bool
    {
        try {
            return is_writable(storage_path());
        } catch (\Throwable) {
            return false;
        }
    }

    private function checkOpcache(): bool
    {
        try {
            if (! function_exists('opcache_get_status')) {
                return false;
            }
            $status = opcache_get_status(false);

            return is_array($status) && ($status['opcache_enabled'] ?? false) === true;
        } catch (\Throwable) {
            return false;
        }
    }
}
