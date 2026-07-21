<?php

return [
    /*
    | Maximum concurrent rooms before new creation is rejected.
    | This is a hard ceiling for the single-core polling budget.
    | A room counts as "active" if its last_activity_at is within
    | the last 2 hours (checked via a direct COUNT on the indexed
    | column — fast enough at MVP scale; no cache layer needed).
    */
    'max_concurrent_rooms' => (int) env('TAMASHAROOM_MAX_CONCURRENT_ROOMS', 50),
];
