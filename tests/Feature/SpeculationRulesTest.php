<?php

declare(strict_types=1);

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SpeculationRulesTest extends TestCase
{
    #[Test]
    public function endpoint_serves_empty_cacheable_rules(): void
    {
        $response = $this->get('/speculation-rules');

        $response->assertOk();
        $this->assertSame('application/speculationrules+json', $response->headers->get('Content-Type'));
        $this->assertSame(['prefetch' => [], 'prerender' => []], $response->json());
        // Symfony's HeaderBag reorders directives canonically.
        $this->assertSame('max-age=604800, public', $response->headers->get('Cache-Control'));
    }

    #[Test]
    public function production_documents_point_speculation_rules_at_our_endpoint(): void
    {
        $this->app['env'] = 'production';

        $response = $this->get('/login');

        $response->assertOk();
        // Quoted-URL form — the exact shape Cloudflare itself emits, and the
        // signal CF respects to leave Speed Brain's injected rules out.
        $this->assertSame('"/speculation-rules"', $response->headers->get('Speculation-Rules'));
        $this->assertSame('max-age=31536000; includeSubDomains', $response->headers->get('Strict-Transport-Security'));
    }

    #[Test]
    public function non_production_responses_carry_no_speculation_rules_header(): void
    {
        $response = $this->get('/login');

        $response->assertOk();
        $this->assertNull($response->headers->get('Speculation-Rules'));
        $this->assertNull($response->headers->get('Strict-Transport-Security'));
    }
}
