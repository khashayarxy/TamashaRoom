<!DOCTYPE html>
<html lang="fa" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0A0A0F">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'تماشاروم') }}</title>

        <link rel="preload" as="font" type="font/woff2" href="{{ Vite::asset('resources/fonts/vazirmatn-var.woff2') }}" crossorigin="anonymous">

        @routes(nonce: $cspNonce ?? null)
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased {{ $themeClass ?? '' }}">
        @inertia
    </body>
</html>
