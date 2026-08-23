<?php

declare(strict_types=1);

namespace App\Services;

enum CodecDetectionResult: string
{
    case SUPPORTED_H264 = 'supported_h264';
    case UNSUPPORTED_HEVC = 'unsupported_hevc';
    case UNKNOWN = 'unknown';

    public function isConfidentlyHEVC(): bool
    {
        return $this === self::UNSUPPORTED_HEVC;
    }
}
