<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\UrlSecurityService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class UrlSecurityServiceTest extends TestCase
{
    private UrlSecurityService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new UrlSecurityService;
    }

    #[Test]
    public function allows_public_https_url(): void
    {
        $error = $this->service->validateVideoUrl('https://example.com/video.mp4');
        $this->assertNull($error);
    }

    #[Test]
    public function allows_public_http_url(): void
    {
        $error = $this->service->validateVideoUrl('http://example.com/video.mp4');
        $this->assertNull($error);
    }

    #[Test]
    public function rejects_invalid_url_format(): void
    {
        $error = $this->service->validateVideoUrl('not-a-url');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_localhost_hostname(): void
    {
        $error = $this->service->validateVideoUrl('http://localhost/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_127_0_0_1_ip(): void
    {
        $error = $this->service->validateVideoUrl('http://127.0.0.1/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_private_10_x_x_x(): void
    {
        $error = $this->service->validateVideoUrl('http://10.0.0.1/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_private_172_16_x_x(): void
    {
        $error = $this->service->validateVideoUrl('http://172.16.0.1/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_private_192_168_x_x(): void
    {
        $error = $this->service->validateVideoUrl('http://192.168.0.1/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_0_0_0_0(): void
    {
        $error = $this->service->validateVideoUrl('http://0.0.0.0/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_ftp_scheme(): void
    {
        $error = $this->service->validateVideoUrl('ftp://example.com/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_local_suffix_hostname(): void
    {
        $error = $this->service->validateVideoUrl('http://server.local/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_link_local_169_254_range(): void
    {
        $error = $this->service->validateVideoUrl('http://169.254.1.1/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function rejects_carrier_grade_nat_100_64_range(): void
    {
        $error = $this->service->validateVideoUrl('http://100.64.0.1/video.mp4');
        $this->assertNotNull($error);
    }

    #[Test]
    public function allows_public_url_with_port(): void
    {
        $error = $this->service->validateVideoUrl('https://example.com:8080/video.mp4');
        $this->assertNull($error);
    }

    #[Test]
    public function rejects_empty_host(): void
    {
        $error = $this->service->validateVideoUrl('http:///video.mp4');
        $this->assertNotNull($error);
    }

    // ─── IPv4-mapped IPv6 (::ffff:a.b.c.d) must be evaluated by the IPv4 checks ───

    private function isPrivateIp(string $ip): bool
    {
        $method = new \ReflectionMethod($this->service, 'isPrivateIp');

        return $method->invoke($this->service, $ip);
    }

    #[Test]
    public function rejects_ipv4_mapped_loopback(): void
    {
        $this->assertTrue($this->isPrivateIp('::ffff:127.0.0.1'));
    }

    #[Test]
    public function rejects_ipv4_mapped_private_10_x(): void
    {
        $this->assertTrue($this->isPrivateIp('::ffff:10.0.0.1'));
    }

    #[Test]
    public function rejects_ipv4_mapped_private_172_16_x(): void
    {
        $this->assertTrue($this->isPrivateIp('::ffff:172.16.5.1'));
    }

    #[Test]
    public function rejects_ipv4_mapped_private_192_168_x(): void
    {
        $this->assertTrue($this->isPrivateIp('::ffff:192.168.1.1'));
    }

    #[Test]
    public function rejects_ipv4_mapped_link_local(): void
    {
        $this->assertTrue($this->isPrivateIp('::ffff:169.254.1.1'));
    }

    #[Test]
    public function rejects_ipv4_mapped_cgnat(): void
    {
        $this->assertTrue($this->isPrivateIp('::ffff:100.64.0.1'));
    }

    #[Test]
    public function allows_ipv4_mapped_public_address(): void
    {
        $this->assertFalse($this->isPrivateIp('::ffff:8.8.8.8'));
    }
}
