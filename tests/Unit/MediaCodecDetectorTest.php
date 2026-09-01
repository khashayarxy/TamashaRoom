<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\CodecDetectionResult;
use App\Services\MediaCodecDetector;
use Tests\TestCase;

class MediaCodecDetectorTest extends TestCase
{
    private MediaCodecDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->detector = new MediaCodecDetector;
    }

    public function test_detects_mp4_h264(): void
    {
        $bytes = "\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2avc1mp41";
        $result = $this->detector->detectFromBytes($bytes);
        $this->assertSame(CodecDetectionResult::SUPPORTED_H264, $result);
        $this->assertFalse($result->isConfidentlyHEVC());
    }

    public function test_detects_mp4_hevc(): void
    {
        $bytes = "\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isomhev1";
        $result = $this->detector->detectFromBytes($bytes);
        $this->assertSame(CodecDetectionResult::UNSUPPORTED_HEVC, $result);
        $this->assertTrue($result->isConfidentlyHEVC());

        $bytesHvc1 = "\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isomhvc1";
        $resultHvc1 = $this->detector->detectFromBytes($bytesHvc1);
        $this->assertSame(CodecDetectionResult::UNSUPPORTED_HEVC, $resultHvc1);
        $this->assertTrue($resultHvc1->isConfidentlyHEVC());
    }

    public function test_detects_mkv_h264(): void
    {
        $bytes = "\x1A\x45\xDF\xA3\x9F\x42\x86\x81\x01\x42\xF7\x81\x01...V_MPEG4/ISO/AVC...";
        $result = $this->detector->detectFromBytes($bytes);
        $this->assertSame(CodecDetectionResult::SUPPORTED_H264, $result);
    }

    public function test_detects_mkv_hevc(): void
    {
        $bytes = "\x1A\x45\xDF\xA3\x9F\x42\x86\x81\x01\x42\xF7\x81\x01...V_MPEGH/ISO/HEVC...";
        $result = $this->detector->detectFromBytes($bytes);
        $this->assertSame(CodecDetectionResult::UNSUPPORTED_HEVC, $result);
        $this->assertTrue($result->isConfidentlyHEVC());
    }

    public function test_returns_unknown_for_short_or_garbage_bytes(): void
    {
        $this->assertSame(CodecDetectionResult::UNKNOWN, $this->detector->detectFromBytes('short'));
        $this->assertSame(CodecDetectionResult::UNKNOWN, $this->detector->detectFromBytes(str_repeat('A', 100)));
    }
}
