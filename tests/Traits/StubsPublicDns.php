<?php

declare(strict_types=1);

namespace Tests\Traits;

use App\Services\UrlSecurityService;
use Closure;

/**
 * Makes DNS-dependent URL tests hermetic.
 *
 * example.com is IANA-reserved documentation space with a stable public IP
 * (93.184.215.14) that never falls in a blocked range, so tests asserting
 * "allows public URL" don't need real DNS — which developer VPNs routinely
 * hijack (DNS64/NAT64 synthesis returns ULA addresses the guard correctly
 * rejects). All other hosts resolve to nothing, preserving every rejection
 * path (blocklist, literal private IPs, unresolvable hosts).
 */
trait StubsPublicDns
{
    /** @return Closure(string): list<string> */
    protected function exampleComResolver(): Closure
    {
        return static fn (string $host): array => $host === 'example.com' ? ['93.184.215.14'] : [];
    }

    protected function bindPublicDnsStub(): void
    {
        $resolver = $this->exampleComResolver();
        $this->app->bind(
            UrlSecurityService::class,
            static fn (): UrlSecurityService => new UrlSecurityService(dnsResolver: $resolver),
        );
    }
}
