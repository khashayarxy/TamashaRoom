<?php

declare(strict_types=1);

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    #[Test]
    public function health_endpoint_reports_consistent_status_and_checks(): void
    {
        $response = $this->get('/api/health');

        $checks = $response->json('checks');
        $this->assertIsArray($checks);
        foreach (['database', 'cache', 'storage', 'opcache'] as $key) {
            $this->assertArrayHasKey($key, $checks);
            $this->assertIsBool($checks[$key]);
        }

        // The status is derived from the checks, never hardcoded: `ok`/200
        // only when every check passes, otherwise `degraded`/503. (In CLI
        // contexts such as PHPUnit, OPcache is typically disabled via
        // opcache.enable_cli=0, so this environment reports degraded — the
        // assertion holds either way.)
        $allPass = ! in_array(false, $checks, true);
        $response->assertJsonPath('status', $allPass ? 'ok' : 'degraded');
        $response->assertStatus($allPass ? 200 : 503);
        $response->assertJsonStructure(['status', 'checks', 'timestamp']);
    }

    #[Test]
    public function health_endpoint_reports_opcache_as_bool(): void
    {
        // OPcache is the main performance lever on shared hosting. The key
        // must always be present so monitoring can alert on a host without
        // bytecode caching; the value is environment-dependent (true under
        // php-fpm with OPcache enabled, e.g. Herd and cPanel PHP 8.4).
        $response = $this->get('/api/health');

        $checks = $response->json('checks');
        $this->assertIsArray($checks);
        $this->assertArrayHasKey('opcache', $checks);
        $this->assertIsBool($checks['opcache']);
    }
}
