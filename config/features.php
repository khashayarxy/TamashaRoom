<?php

declare(strict_types=1);

return [
    'chat_moderation' => env('FEATURE_CHAT_MODERATION', true),
    'subtitle_upload' => env('FEATURE_SUBTITLE_UPLOAD', true),
    'room_locking' => env('FEATURE_ROOM_LOCKING', true),
    'audit_logging' => env('FEATURE_AUDIT_LOGGING', true),
    'new_ui_design' => env('FEATURE_NEW_UI_DESIGN', false),
];
