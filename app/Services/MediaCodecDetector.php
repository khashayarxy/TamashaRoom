<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\CodecDetectionResult;
use Illuminate\Support\Facades\Log;

class MediaCodecDetector
{
    public function __construct(
        private readonly UrlSecurityService $urlSecurity = new UrlSecurityService,
    ) {}

    /**
     * Best-effort codec detection by safely fetching range bytes via UrlSecurityService.
     * Returns UNKNOWN on timeout, network failure, or ambiguous headers (never blocks).
     */
    public function detectFromUrl(string $url): CodecDetectionResult
    {
        try {
            $bytes = $this->urlSecurity->fetchRangeBytes($url, 65536, 3);
            if ($bytes === null || strlen($bytes) < 16) {
                return CodecDetectionResult::UNKNOWN;
            }

            return $this->detectFromBytes($bytes);
        } catch (\Throwable $e) {
            Log::info("MediaCodecDetector: Exception during url inspection for {$url}: {$e->getMessage()}");

            return CodecDetectionResult::UNKNOWN;
        }
    }

    /**
     * Inspect byte buffer for MP4 / MKV video container & codec markers.
     */
    public function detectFromBytes(string $bytes): CodecDetectionResult
    {
        if (strlen($bytes) < 16) {
            return CodecDetectionResult::UNKNOWN;
        }

        // 1. Check MKV / Matroska EBML signature (\x1A\x45\xDF\xA3)
        if (str_starts_with($bytes, "\x1A\x45\xDF\xA3")) {
            return $this->detectMkvCodec($bytes);
        }

        // 2. Check MP4 container (ftyp atom or box structure)
        if (str_contains(substr($bytes, 0, 64), 'ftyp') || $this->isMp4BoxStructure($bytes)) {
            return $this->detectMp4Codec($bytes);
        }

        return CodecDetectionResult::UNKNOWN;
    }

    /**
     * Detect codec inside MP4 byte buffer.
     */
    private function detectMp4Codec(string $bytes): CodecDetectionResult
    {
        // HEVC FourCC markers inside stsd / track description boxes
        if (str_contains($bytes, 'hvc1') || str_contains($bytes, 'hev1')) {
            return CodecDetectionResult::UNSUPPORTED_HEVC;
        }

        // H.264 FourCC markers inside stsd / track description boxes
        if (str_contains($bytes, 'avc1') || str_contains($bytes, 'avc3')) {
            return CodecDetectionResult::SUPPORTED_H264;
        }

        return CodecDetectionResult::UNKNOWN;
    }

    /**
     * Detect codec inside MKV / Matroska byte buffer.
     */
    private function detectMkvCodec(string $bytes): CodecDetectionResult
    {
        // HEVC CodecID in Matroska: V_MPEGH/ISO/HEVC or H265/HEVCFourCC
        if (str_contains($bytes, 'V_MPEGH/ISO/HEVC') || str_contains($bytes, 'H265') || str_contains($bytes, 'HEVC')) {
            return CodecDetectionResult::UNSUPPORTED_HEVC;
        }

        // H.264 CodecID in Matroska: V_MPEG4/ISO/AVC
        if (str_contains($bytes, 'V_MPEG4/ISO/AVC') || str_contains($bytes, 'H264') || str_contains($bytes, 'AVC')) {
            return CodecDetectionResult::SUPPORTED_H264;
        }

        return CodecDetectionResult::UNKNOWN;
    }

    private function isMp4BoxStructure(string $bytes): bool
    {
        return str_contains($bytes, 'moov') || str_contains($bytes, 'mdat') || str_contains($bytes, 'stsd');
    }
}
