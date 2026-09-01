<?php

declare(strict_types=1);

namespace App\Services;

class ContentModerator
{
    public function containsBlockedContent(string $text): bool
    {
        if (! config('moderation.enabled')) {
            return false;
        }

        $words = config('moderation.blocked_words', []);
        $lowerText = mb_strtolower($text);

        foreach ($words as $word) {
            if (str_contains($lowerText, mb_strtolower((string) $word))) {
                return true;
            }
        }

        return false;
    }
}
