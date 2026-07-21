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
}
