<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Pages
    |--------------------------------------------------------------------------
    |
    | Inertia's package default searches `resources/js/pages` (lowercase). The
    | repo stores page components under `resources/js/Pages`. On case-sensitive
    | filesystems (Linux/GitHub Actions) the default path never matches, which
    | breaks the `assertInertia` page-existence check (tests) and any page
    | component existence assertion. This override keeps the search path in
    | sync with the real directory casing.
    |
    */

    'pages' => [

        'ensure_pages_exist' => false,

        'paths' => [

            resource_path('js/Pages'),

        ],

        'extensions' => [

            'js',
            'jsx',
            'svelte',
            'ts',
            'tsx',
            'vue',

        ],

    ],

];
