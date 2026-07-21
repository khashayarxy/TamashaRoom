<?php

declare(strict_types=1);

namespace App\Services;

class SubtitleConverterService
{
    public function convertToVtt(string $content, string $extension): string
    {
        return match (strtolower($extension)) {
            'srt' => $this->srtToVtt($content),
            default => $this->ensureVttHeader($content),
        };
    }

    public function srtToVtt(string $srt): string
    {
        $vtt = "WEBVTT\n\n";

        $blocks = preg_split('/\n\s*\n/', trim($srt));

        foreach ($blocks as $block) {
            $lines = explode("\n", $block);
            $timeLine = null;
            $textLines = [];

            foreach ($lines as $line) {
                $trimmed = trim($line);
                if (preg_match('/\d{2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{1,3}/', $trimmed)) {
                    $timeLine = $trimmed;
                } elseif ($trimmed !== '' && ! preg_match('/^\d+$/', $trimmed)) {
                    $textLines[] = $trimmed;
                }
            }

            if ($timeLine !== null && $textLines !== []) {
                $vtt .= str_replace(',', '.', $timeLine)."\n";
                $vtt .= implode("\n", $textLines)."\n\n";
            }
        }

        return $vtt;
    }

    public function ensureVttHeader(string $content): string
    {
        if (str_starts_with(trim($content), 'WEBVTT')) {
            return $content;
        }

        return "WEBVTT\n\n".$content;
    }

    public function extractCues(string $vtt): array
    {
        $cues = [];
        $normalized = str_replace("\r\n", "\n", $vtt);
        $lines = explode("\n", $normalized);
        $i = 0;

        while ($i < count($lines) && trim($lines[$i]) !== 'WEBVTT' && trim($lines[$i]) !== '') {
            $i++;
        }
        if ($i < count($lines) && trim($lines[$i]) === 'WEBVTT') {
            $i++;
        }

        while ($i < count($lines)) {
            $line = trim($lines[$i]);
            if ($line === '' || preg_match('/^\d+$/', $line)) {
                $i++;

                continue;
            }

            if (preg_match('/^(\d{2}:)?(\d{2}):(\d{2})[.](\d{1,3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[.](\d{1,3})/', $line, $m)) {
                $start = $this->timeToMs($m[1] ?? '00', $m[2], $m[3], $m[4]);
                $end = $this->timeToMs($m[5] ?? '00', $m[6], $m[7], $m[8]);
                $i++;
                $textLines = [];
                while ($i < count($lines) && trim($lines[$i]) !== '') {
                    if (! str_starts_with(trim($lines[$i]), 'NOTE')) {
                        $textLines[] = preg_replace('/<[^>]*>/', '', $lines[$i]);
                    }
                    $i++;
                }
                if ($textLines !== []) {
                    $cues[] = [
                        'start' => $start,
                        'end' => $end,
                        'text' => implode("\n", $textLines),
                    ];
                }
            }
            $i++;
        }

        return $cues;
    }

    private function timeToMs(string $h, string $m, string $s, string $ms): int
    {
        return ((int) $h * 3600 + (int) $m * 60 + (int) $s) * 1000 + (int) str_pad($ms, 3, '0');
    }
}
