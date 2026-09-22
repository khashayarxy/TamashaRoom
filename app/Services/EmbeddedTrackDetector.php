<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * A single audio/subtitle track found in a container header.
 */
final class EmbeddedTrack
{
    public function __construct(
        /** 'subtitle' or 'audio'. */
        public readonly string $kind,
        /** Raw language code as muxed (e.g. 'per', 'eng', 'fa'), or null. */
        public readonly ?string $language,
        /**
         * 0-based position among same-kind tracks in file order. The client
         * uses it as a fallback to pick the nth native track when languages
         * are missing or ambiguous.
         */
        public readonly int $index,
        /** Codec identifier as muxed (e.g. 'tx3g', 'V_MPEGH/ISO/HEVC', 'mp4a'). */
        public readonly ?string $codec,
        /** Container-provided track name, if any. */
        public readonly ?string $label,
        /** Container the track was parsed from ('mkv' or 'mp4'). */
        public readonly ?string $container = null,
    ) {}
}

/**
 * Best-effort enumeration of embedded audio/subtitle tracks from container
 * headers — pure byte parsing, no FFmpeg, no exec, no extra processes
 * (shared cPanel hosting has none of those). Operates on the same small
 * header-range fetch the codec detector uses; anything beyond the fetched
 * bytes (e.g. a non-fast-start MP4 whose moov sits at EOF) yields no tracks
 * rather than an error — detection is opportunistic by design.
 */
class EmbeddedTrackDetector
{
    private const MAX_ELEMENTS = 512;

    public function __construct(
        private readonly UrlSecurityService $urlSecurity,
    ) {}

    /**
     * @return list<EmbeddedTrack>
     */
    public function detectFromUrl(string $url): array
    {
        try {
            $bytes = $this->urlSecurity->fetchRangeBytes($url, 65536, 3);
            if ($bytes === null || strlen($bytes) < 16) {
                return [];
            }

            return $this->detectFromBytes($bytes);
        } catch (\Throwable $e) {
            Log::info("EmbeddedTrackDetector: Exception during url inspection for {$url}: {$e->getMessage()}");

            return [];
        }
    }

    /**
     * @return list<EmbeddedTrack>
     */
    public function detectFromBytes(string $bytes): array
    {
        if (strlen($bytes) < 16) {
            return [];
        }

        if (str_starts_with($bytes, "\x1A\x45\xDF\xA3")) {
            return $this->detectMkvTracks($bytes);
        }

        if (str_contains(substr($bytes, 0, 64), 'ftyp') || str_contains($bytes, 'moov')) {
            return $this->detectMp4Tracks($bytes);
        }

        return [];
    }

    /**
     * Pick the room-default subtitle: Persian when present, else the first
     * subtitle track. Returns null when there are no subtitle tracks.
     *
     * @param  list<EmbeddedTrack>  $tracks
     */
    public static function pickDefaultSubtitle(array $tracks): ?EmbeddedTrack
    {
        $subtitles = array_values(array_filter(
            $tracks,
            static fn (EmbeddedTrack $t): bool => $t->kind === 'subtitle',
        ));

        if ($subtitles === []) {
            return null;
        }

        foreach ($subtitles as $track) {
            if (self::isPersianLanguage($track->language)) {
                return $track;
            }
        }

        return $subtitles[0];
    }

    /**
     * Persian arrives under several codes depending on the muxer:
     * BCP-47 'fa'/'fa-IR', ISO-639-2/T 'fas', ISO-639-2/B 'per', and the
     * occasional free-text 'farsi'.
     */
    public static function isPersianLanguage(?string $code): bool
    {
        if ($code === null) {
            return false;
        }

        $base = strtolower(explode('-', str_replace('_', '-', $code))[0]);

        return in_array($base, ['fa', 'fas', 'per', 'farsi', 'parsi'], true);
    }

    /**
     * @return list<EmbeddedTrack>
     */
    private function detectMkvTracks(string $bytes): array
    {
        $len = strlen($bytes);

        // Skip the EBML header, then descend into the Segment: Tracks is a
        // child of Segment, not a top-level sibling.
        $offset = $this->ebmlElementLength($bytes, 0, $len);
        if ($offset === null) {
            return [];
        }
        $segment = $this->ebmlReadElement($bytes, $offset, $len);
        if ($segment === null) {
            return [];
        }

        // Find the Tracks element (0x1654AE6B) within the Segment.
        $tracksPos = $this->ebmlFind($bytes, $segment[2], $segment[1], "\x16\x54\xAE\x6B", 64);
        if ($tracksPos === null) {
            return [];
        }

        $parsed = $this->ebmlReadElement($bytes, $tracksPos, $len);
        if ($parsed === null) {
            return [];
        }
        [$tracksEnd, $cursor] = [$parsed[1], $parsed[2]];

        $found = [];
        $iterations = 0;
        while ($cursor < $tracksEnd && $iterations++ < self::MAX_ELEMENTS) {
            $entry = $this->ebmlReadElement($bytes, $cursor, $len);
            if ($entry === null) {
                break;
            }
            [$id, $end, $contentStart] = [$entry[0], $entry[1], $entry[2]];
            $cursor = $end;
            if ($id !== "\xAE" || $end <= $contentStart) {
                continue;
            }
            $parsed = $this->parseMkvTrackEntry(substr($bytes, $contentStart, $end - $contentStart));
            if ($parsed !== null) {
                $found[] = $parsed;
            }
        }

        return $this->indexTracks($found, 'mkv');
    }

    /**
     * Parse one TrackEntry payload. Returns [kind, language, codec, label]
     * or null when the entry has no usable type.
     *
     * @return array{string, ?string, ?string, ?string}|null
     */
    private function parseMkvTrackEntry(string $payload): ?array
    {
        $len = strlen($payload);
        $cursor = 0;
        $iterations = 0;
        $type = null;
        $language = null;
        $codec = null;
        $label = null;

        while ($cursor < $len && $iterations++ < 64) {
            $el = $this->ebmlReadElement($payload, $cursor, $len);
            if ($el === null) {
                break;
            }
            [$id, $end, $contentStart] = [$el[0], $el[1], $el[2]];
            $cursor = $end;
            $data = substr($payload, $contentStart, max(0, $end - $contentStart));
            // Track-name elements are intentionally unparsed (their ID
            // encoding is easy to get subtly wrong, and labels are
            // nice-to-have): unknown children are skipped by measured
            // length, so parsing stays aligned regardless.
            match ($id) {
                "\x83" => $type = $this->ebmlUint($data),
                "\x22\xB5\x9C" => $language = $this->cleanString($data),
                "\x86" => $codec = $this->cleanString($data),
                default => null,
            };
        }

        // TrackType: 0x01 video, 0x02 audio, 0x11 subtitle.
        $kind = match ($type) {
            0x11 => 'subtitle',
            0x02 => 'audio',
            default => null,
        };

        if ($kind === null) {
            return null;
        }

        // Matroska defaults an absent Language to English.
        return [$kind, $language ?? 'eng', $codec, $label];
    }

    /**
     * @return list<EmbeddedTrack>
     */
    private function detectMp4Tracks(string $bytes): array
    {
        $len = strlen($bytes);
        $moov = $this->mp4Find($bytes, 0, $len, 'moov', 64);
        if ($moov === null) {
            // No moov in range (e.g. non-fast-start file with moov at EOF).
            return [];
        }

        $found = [];
        $iterations = 0;
        [$moovStart, $moovEnd] = $moov;
        $cursor = $moovStart + 8;
        while ($cursor + 8 <= $moovEnd && $iterations++ < self::MAX_ELEMENTS) {
            $box = $this->mp4ReadBox($bytes, $cursor, $len);
            if ($box === null) {
                break;
            }
            [$type, $start, $end, $cursor] = $box;
            if ($type === 'trak' && $end > $start) {
                $parsed = $this->parseMp4Trak(
                    substr($bytes, $start, $end - $start),
                );
                if ($parsed !== null) {
                    $found[] = $parsed;
                }
            }
        }

        return $this->indexTracks($found, 'mp4');
    }

    /**
     * Parse one trak box. Returns [kind, language, codec, label] or null for
     * non-audio/subtitle tracks.
     *
     * @return array{string, ?string, ?string, ?string}|null
     */
    private function parseMp4Trak(string $trak): ?array
    {
        $len = strlen($trak);
        // mdia with hdlr handler + mdhd language; stsd entry FourCC as codec.
        $mdia = $this->mp4Find($trak, 0, $len, 'mdia', 16);
        if ($mdia === null) {
            return null;
        }

        $handler = null;
        $hdlr = $this->mp4Find($trak, $mdia[0], $mdia[1], 'hdlr', 8);
        if ($hdlr !== null) {
            // version(1) + flags(3) + pre_defined(4) + handler_type(4).
            $handler = substr($trak, $hdlr[0] + 8, 4);
        }

        $language = null;
        $mdhd = $this->mp4Find($trak, $mdia[0], $mdia[1], 'mdhd', 8);
        if ($mdhd !== null) {
            $language = $this->mp4UnpackLanguage($trak, $mdhd[0]);
        }

        // stsd lives at mdia/minf/stbl/stsd — walk the fixed chain
        // explicitly rather than recursing, so unusual nesting can't
        // misattribute a sibling box's contents.
        $codec = null;
        $minf = $this->mp4Find($trak, $mdia[0], $mdia[1], 'minf', 8);
        $stbl = $minf !== null
            ? $this->mp4Find($trak, $minf[0], $minf[1], 'stbl', 8)
            : null;
        $stsd = $stbl !== null
            ? $this->mp4Find($trak, $stbl[0], $stbl[1], 'stsd', 8)
            : null;
        if ($stsd !== null) {
            // version(1) + flags(3) + entry_count(4), then entries.
            $count = unpack('N', substr($trak, $stsd[0] + 4, 4))[1] ?? 0;
            $cursor = $stsd[0] + 8;
            if ($count >= 1 && $cursor + 8 <= $len) {
                $codec = substr($trak, $cursor + 4, 4);
            }
        }

        $kind = match (true) {
            $handler === 'soun' => 'audio',
            $handler === 'subt' || $handler === 'text' => 'subtitle',
            in_array($codec, ['tx3g', 'text', 'wvtt', 'stpp', 'sbtt'], true) => 'subtitle',
            in_array($codec, ['mp4a', 'ac-3', 'ec-3', 'Opus', 'vorb', 'fLaC', 'alac'], true) => 'audio',
            default => null,
        };

        if ($kind === null) {
            return null;
        }

        return [$kind, $language, $codec !== '' ? $codec : null, null];
    }

    /**
     * Assign 0-based per-kind indexes in file order.
     *
     * @param  list<array{string, ?string, ?string, ?string}>  $found
     * @return list<EmbeddedTrack>
     */
    private function indexTracks(array $found, string $container): array
    {
        $counters = ['subtitle' => 0, 'audio' => 0];
        $tracks = [];
        foreach ($found as [$kind, $language, $codec, $label]) {
            $tracks[] = new EmbeddedTrack(
                kind: $kind,
                language: $language,
                index: $counters[$kind]++,
                codec: $codec,
                label: $label,
                container: $container,
            );
        }

        return $tracks;
    }

    /**
     * Read one EBML element header at $offset.
     *
     * @return array{string, int, int}|null [id-bytes, content-end, content-start]
     */
    private function ebmlReadElement(string $bytes, int $offset, int $len): ?array
    {
        if ($offset < 0 || $offset >= $len) {
            return null;
        }

        $first = ord($bytes[$offset]);
        $idLen = 0;
        for ($i = 0; $i < 8; $i++) {
            if ($first & (0x80 >> $i)) {
                $idLen = $i + 1;
                break;
            }
        }
        if ($idLen === 0 || $offset + $idLen >= $len) {
            return null;
        }
        $id = substr($bytes, $offset, $idLen);

        $sizePos = $offset + $idLen;
        $sizeFirst = ord($bytes[$sizePos]);
        $sizeLen = 0;
        for ($i = 0; $i < 8; $i++) {
            if ($sizeFirst & (0x80 >> $i)) {
                $sizeLen = $i + 1;
                break;
            }
        }
        if ($sizeLen === 0 || $sizePos + $sizeLen > $len) {
            return null;
        }
        $sizeValue = $sizeFirst & (0xFF >> $sizeLen);
        for ($i = 1; $i < $sizeLen; $i++) {
            $sizeValue = ($sizeValue << 8) | ord($bytes[$sizePos + $i]);
        }

        $contentStart = $sizePos + $sizeLen;
        // Unknown-size (all value bits set) runs to the parent/buffer end.
        $allOnes = (1 << (7 * $sizeLen)) - 1;
        $contentEnd = $sizeValue === $allOnes
            ? $len
            : min($len, $contentStart + $sizeValue);

        if ($contentEnd < $contentStart) {
            return null;
        }

        return [$id, $contentEnd, $contentStart];
    }

    /**
     * Total element length (header + content) or null when unparseable.
     */
    private function ebmlElementLength(string $bytes, int $offset, int $len): ?int
    {
        $el = $this->ebmlReadElement($bytes, $offset, $len);
        if ($el === null) {
            return null;
        }

        return $el[1] - $offset;
    }

    /**
     * Find a top-level EBML element by id bytes within a bounded scan.
     */
    private function ebmlFind(string $bytes, int $offset, int $len, string $id, int $maxElements): ?int
    {
        $cursor = $offset;
        $iterations = 0;
        while ($cursor < $len && $iterations++ < $maxElements) {
            $el = $this->ebmlReadElement($bytes, $cursor, $len);
            if ($el === null) {
                return null;
            }
            if ($el[0] === $id) {
                return $cursor;
            }
            $next = $el[1];
            if ($next <= $cursor) {
                return null;
            }
            $cursor = $next;
        }

        return null;
    }

    private function ebmlUint(string $data): int
    {
        $value = 0;
        $n = strlen($data);
        for ($i = 0; $i < $n; $i++) {
            $value = ($value << 8) | ord($data[$i]);
        }

        return $value;
    }

    private function cleanString(?string $data): ?string
    {
        if ($data === null) {
            return null;
        }
        $trimmed = trim($data, "\x00 \t\r\n");
        if ($trimmed === '') {
            return null;
        }

        return mb_substr($trimmed, 0, 32);
    }

    /**
     * Find a direct child box by type within [$from, $to). Returns
     * [content-start, content-end] or null. Bounded scan.
     *
     * @return array{int, int}|null
     */
    private function mp4Find(string $bytes, int $from, int $to, string $type, int $maxBoxes): ?array
    {
        $len = strlen($bytes);
        $cursor = max(0, $from);
        $iterations = 0;
        while ($cursor + 8 <= min($to, $len) && $iterations++ < $maxBoxes) {
            $box = $this->mp4ReadBox($bytes, $cursor, $len);
            if ($box === null) {
                return null;
            }
            [$found, $start, $end, $cursor] = $box;
            if ($found === $type) {
                return [$start, min($end, $to)];
            }
        }

        return null;
    }

    /**
     * Read one MP4 box header at $cursor.
     *
     * @return array{string, int, int, int}|null [type, content-start, content-end, next-cursor]
     */
    private function mp4ReadBox(string $bytes, int $cursor, int $len): ?array
    {
        if ($cursor < 0 || $cursor + 8 > $len) {
            return null;
        }

        $size = unpack('N', substr($bytes, $cursor, 4))[1] ?? 0;
        $type = substr($bytes, $cursor + 4, 4);
        $headerLen = 8;

        if ($size === 1) {
            if ($cursor + 16 > $len) {
                return null;
            }
            $parts = unpack('N2', substr($bytes, $cursor + 8, 8));
            if ($parts === false) {
                return null;
            }
            $size = $parts[1] * 4294967296 + $parts[2];
            $headerLen = 16;
        } elseif ($size === 0) {
            $size = $len - $cursor;
        }

        if ($size < $headerLen) {
            return null;
        }

        $end = min($len, $cursor + $size);
        $start = $cursor + $headerLen;

        return [$type, $start, $end, $end];
    }

    /**
     * Unpack the 15-bit ISO-639-2/T language code from an mdhd box.
     */
    private function mp4UnpackLanguage(string $bytes, int $mdhdContentStart): ?string
    {
        $version = ord($bytes[$mdhdContentStart] ?? "\x00");
        // version 0: ver/flags(4) ctime(4) mtime(4) timescale(4)
        // duration(4) language(2) → language at +20.
        // version 1: ver/flags(4) ctime(8) mtime(8) timescale(4)
        // duration(8) language(2) → language at +32.
        $langPos = $mdhdContentStart + ($version === 1 ? 32 : 20);
        if ($langPos + 2 > strlen($bytes)) {
            return null;
        }

        $packed = unpack('n', substr($bytes, $langPos, 2))[1] ?? 0;
        if ($packed === 0) {
            return null;
        }

        $code = chr((($packed >> 10) & 0x1F) + 0x60)
            .chr((($packed >> 5) & 0x1F) + 0x60)
            .chr(($packed & 0x1F) + 0x60);

        return $code === 'und' ? null : $code;
    }
}
