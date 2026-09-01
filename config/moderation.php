<?php

declare(strict_types=1);

return [
    'enabled' => env('CHAT_MODERATION_ENABLED', true),

    'blocked_words' => [
        'spam',
        'test123',
        'رکیک',
        'فحش',
    ],
];
