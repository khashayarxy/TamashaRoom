<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\EmbeddedTrackDetector;
use App\Services\UrlSecurityService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EmbeddedTrackDetectorTest extends TestCase
{
    private EmbeddedTrackDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->detector = new EmbeddedTrackDetector(new UrlSecurityService);
    }

    // -- EBML builders -----------------------------------------------------

    private static function vint(int $value): string
    {
        if ($value < 0x7F) {
            return chr(0x80 | $value);
        }
        if ($value < 0x3FFF) {
            return chr(0x40 | ($value >> 8)).chr($value & 0xFF);
        }

        throw new \InvalidArgumentException('Fixture vint out of range.');
    }

    private static function ebmlElement(string $id, string $content): string
    {
        return $id.self::vint(strlen($content)).$content;
    }

    private static function mkvTrackEntry(int $number, int $type, string $language, string $codec): string
    {
        return self::ebmlElement(
            "\xAE",
            self::ebmlElement("\xD7", chr($number))
            .self::ebmlElement("\x83", chr($type))
            .self::ebmlElement("\x22\xB5\x9C", $language)
            .self::ebmlElement("\x86", $codec),
        );
    }

    private static function mkvFixture(array $entries): string
    {
        $tracks = '';
        foreach ($entries as [$number, $type, $language, $codec]) {
            $tracks .= self::mkvTrackEntry($number, $type, $language, $codec);
        }

        return self::ebmlElement("\x1A\x45\xDF\xA3", "\x42\x86\x81\x01")
            ."\x18\x53\x80\x67\xFF"
            .self::ebmlElement("\x16\x54\xAE\x6B", $tracks);
    }

    // -- MP4 builders --------------------------------------------------------

    private static function box(string $type, string $content): string
    {
        return pack('N', 8 + strlen($content)).$type.$content;
    }

    private static function packLang(string $code): string
    {
        $packed = ((ord($code[0]) - 0x60) << 10)
            | ((ord($code[1]) - 0x60) << 5)
            | (ord($code[2]) - 0x60);

        return pack('n', $packed);
    }

    private static function mp4Trak(string $handler, string $lang3, string $codecFourcc): string
    {
        $mdhd = "\x00\x00\x00\x00" // version + flags
            ."\x00\x00\x00\x00\x00\x00\x00\x00" // ctime + mtime
            .pack('N', 1000).pack('N', 5000) // timescale + duration
            .self::packLang($lang3)."\x00\x00"; // language + quality
        $hdlr = "\x00\x00\x00\x00\x00\x00\x00\x00".$handler.str_repeat("\x00", 12)."\x00";
        // Minimal stsd entry: size + fourcc only (parser reads just that).
        $entry = pack('N', 16).$codecFourcc.str_repeat("\x00", 8);
        $stsd = "\x00\x00\x00\x00".pack('N', 1).$entry;
        $stbl = self::box('stbl', self::box('stsd', $stsd));
        $minf = self::box('minf', $stbl);

        return self::box('trak', self::box('mdia', self::box('mdhd', $mdhd).self::box('hdlr', $hdlr).$minf));
    }

    private static function mp4Fixture(array $traks): string
    {
        $moov = '';
        foreach ($traks as [$handler, $lang3, $codec]) {
            $moov .= self::mp4Trak($handler, $lang3, $codec);
        }

        return self::box('ftyp', "isom\x00\x00\x00\x00isom")
            .self::box('moov', $moov);
    }

    // -- MKV detection ---------------------------------------------------------

    #[Test]
    public function detects_mkv_subtitle_and_audio_tracks_with_languages(): void
    {
        $bytes = self::mkvFixture([
            [1, 0x01, 'eng', 'V_MPEG4/ISO/AVC'],
            [2, 0x02, 'eng', 'A_AAC'],
            [3, 0x11, 'per', 'S_TEXT/UTF8'],
            [4, 0x11, 'eng', 'S_TEXT/UTF8'],
        ]);

        $tracks = $this->detector->detectFromBytes($bytes);

        $this->assertCount(3, $tracks);
        $this->assertSame('audio', $tracks[0]->kind);
        $this->assertSame('eng', $tracks[0]->language);
        $this->assertSame(0, $tracks[0]->index);
        $this->assertSame('subtitle', $tracks[1]->kind);
        $this->assertSame('per', $tracks[1]->language);
        $this->assertSame(0, $tracks[1]->index);
        $this->assertSame('subtitle', $tracks[2]->kind);
        $this->assertSame(1, $tracks[2]->index);
    }

    #[Test]
    public function returns_empty_for_mkv_without_tracks_element(): void
    {
        $bytes = self::ebmlElement("\x1A\x45\xDF\xA3", "\x42\x86\x81\x01")
            ."\x18\x53\x80\x67\xFF"
            .self::ebmlElement("\xEC", 'void-content');

        $this->assertSame([], $this->detector->detectFromBytes($bytes));
    }

    // -- MP4 detection -----------------------------------------------------------

    #[Test]
    public function detects_mp4_subtitle_and_audio_tracks(): void
    {
        $bytes = self::mp4Fixture([
            ['vide', 'und', 'avc1'],
            ['soun', 'eng', 'mp4a'],
            ['subt', 'per', 'tx3g'],
        ]);

        $tracks = $this->detector->detectFromBytes($bytes);

        $this->assertCount(2, $tracks);
        $this->assertSame('audio', $tracks[0]->kind);
        $this->assertSame('eng', $tracks[0]->language);
        $this->assertSame('mp4a', $tracks[0]->codec);
        $this->assertSame('subtitle', $tracks[1]->kind);
        $this->assertSame('per', $tracks[1]->language);
        $this->assertSame('tx3g', $tracks[1]->codec);
        $this->assertSame(0, $tracks[1]->index);
    }

    #[Test]
    public function returns_empty_for_mp4_without_moov_in_range(): void
    {
        // ftyp + mdat only: non-fast-start file whose moov sits at EOF.
        $bytes = self::box('ftyp', "isom\x00\x00\x00\x00isom")
            .self::box('mdat', str_repeat("\x00", 64));

        $this->assertSame([], $this->detector->detectFromBytes($bytes));
    }

    // -- Robustness -----------------------------------------------------------------

    #[Test]
    public function returns_empty_for_garbage_and_truncated_input(): void
    {
        $this->assertSame([], $this->detector->detectFromBytes(''));
        $this->assertSame([], $this->detector->detectFromBytes('short'));
        $this->assertSame(
            [],
            $this->detector->detectFromBytes(random_bytes(256)),
        );
        $full = self::mkvFixture([[1, 0x11, 'eng', 'S_TEXT/UTF8']]);
        $this->assertSame(
            [],
            $this->detector->detectFromBytes(substr($full, 0, 20)),
        );
    }

    // -- Default picking --------------------------------------------------------------

    #[Test]
    public function prefers_persian_subtitle_as_default(): void
    {
        $tracks = $this->detector->detectFromBytes(self::mkvFixture([
            [1, 0x11, 'eng', 'S_TEXT/UTF8'],
            [2, 0x11, 'per', 'S_TEXT/UTF8'],
        ]));

        $default = EmbeddedTrackDetector::pickDefaultSubtitle($tracks);

        $this->assertNotNull($default);
        $this->assertSame('per', $default->language);
    }

    #[Test]
    public function falls_back_to_first_subtitle_without_persian(): void
    {
        $tracks = $this->detector->detectFromBytes(self::mkvFixture([
            [1, 0x11, 'eng', 'S_TEXT/UTF8'],
            [2, 0x11, 'deu', 'S_TEXT/UTF8'],
        ]));

        $default = EmbeddedTrackDetector::pickDefaultSubtitle($tracks);

        $this->assertNotNull($default);
        $this->assertSame('eng', $default->language);
    }

    #[Test]
    public function returns_null_default_without_subtitle_tracks(): void
    {
        $tracks = $this->detector->detectFromBytes(self::mkvFixture([
            [1, 0x02, 'eng', 'A_AAC'],
        ]));

        $this->assertSame([], array_filter(
            $tracks,
            static fn ($t): bool => $t->kind === 'subtitle',
        ));
        $this->assertNull(EmbeddedTrackDetector::pickDefaultSubtitle($tracks));
    }

    #[Test]
    public function recognizes_persian_language_variants(): void
    {
        foreach (['fa', 'FA', 'fa-IR', 'fas', 'per', 'farsi'] as $code) {
            $this->assertTrue(
                EmbeddedTrackDetector::isPersianLanguage($code),
                "Failed for {$code}",
            );
        }

        foreach (['eng', 'en', 'deu', 'ara', null] as $code) {
            $this->assertFalse(
                EmbeddedTrackDetector::isPersianLanguage($code),
                'Failed for '.var_export($code, true),
            );
        }
    }
}
