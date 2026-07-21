<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\SubtitleConverterService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SubtitleConverterTest extends TestCase
{
    private SubtitleConverterService $converter;

    protected function setUp(): void
    {
        parent::setUp();
        $this->converter = new SubtitleConverterService;
    }

    #[Test]
    public function it_converts_srt_to_vtt(): void
    {
        $srt = "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:05,000 --> 00:00:08,000\nSecond cue\nwith two lines";

        $vtt = $this->converter->convertToVtt($srt, 'srt');

        $this->assertStringStartsWith('WEBVTT', $vtt);
        $this->assertStringContainsString('00:00:01.000 --> 00:00:04.000', $vtt);
        $this->assertStringContainsString('Hello world', $vtt);
        $this->assertStringContainsString('00:00:05.000 --> 00:00:08.000', $vtt);
        $this->assertStringContainsString("Second cue\nwith two lines", $vtt);
    }

    #[Test]
    public function it_converts_srt_comma_to_vtt_dot(): void
    {
        $srt = "1\n00:01:30,500 --> 00:01:35,750\nComma decimals";

        $vtt = $this->converter->convertToVtt($srt, 'srt');

        $this->assertStringContainsString('00:01:30.500 --> 00:01:35.750', $vtt);
    }

    #[Test]
    public function it_passes_through_vtt_content(): void
    {
        $vttInput = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nDirect VTT";

        $result = $this->converter->convertToVtt($vttInput, 'vtt');

        $this->assertEquals($vttInput, $result);
    }

    #[Test]
    public function it_adds_webvtt_header_if_missing(): void
    {
        $vttInput = "00:00:01.000 --> 00:00:04.000\nNo header";

        $result = $this->converter->ensureVttHeader($vttInput);

        $this->assertStringStartsWith("WEBVTT\n\n", $result);
    }

    #[Test]
    public function it_preserves_utf8_persian_text(): void
    {
        $srt = "1\n00:00:01,000 --> 00:00:04,000\nسلام دنیا\nاین یک زیرنویس فارسی است";

        $vtt = $this->converter->convertToVtt($srt, 'srt');

        $this->assertStringContainsString('سلام دنیا', $vtt);
        $this->assertStringContainsString('این یک زیرنویس فارسی است', $vtt);
    }

    #[Test]
    public function it_extracts_cues_from_vtt(): void
    {
        $vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nFirst cue\n\n00:00:05.000 --> 00:00:08.500\nSecond cue";

        $cues = $this->converter->extractCues($vtt);

        $this->assertCount(2, $cues);
        $this->assertEquals(1000, $cues[0]['start']);
        $this->assertEquals(4000, $cues[0]['end']);
        $this->assertEquals('First cue', $cues[0]['text']);
        $this->assertEquals(5000, $cues[1]['start']);
        $this->assertEquals(8500, $cues[1]['end']);
        $this->assertEquals('Second cue', $cues[1]['text']);
    }

    #[Test]
    public function it_handles_empty_srt(): void
    {
        $vtt = $this->converter->convertToVtt('', 'srt');
        $this->assertEquals("WEBVTT\n\n", $vtt);
    }

    #[Test]
    public function it_skips_notes_in_vtt(): void
    {
        $vtt = "WEBVTT\n\nNOTE This is a comment\n\n00:00:01.000 --> 00:00:04.000\nVisible cue";

        $cues = $this->converter->extractCues($vtt);

        $this->assertCount(1, $cues);
        $this->assertEquals('Visible cue', $cues[0]['text']);
    }
}
