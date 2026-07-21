<!DOCTYPE html>
<html lang="fa" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0F172A">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'TamashaRoom') }}</title>

        <link rel="preload" as="font" type="font/woff2" href="/fonts/vazirmatn-var.woff2" crossorigin="anonymous">

        @routes
        @viteReactRefresh
        @vite('resources/js/app.tsx')
        @inertiaHead
    </head>
    <body class="font-sans antialiased {{ $themeClass ?? '' }}">
        @inertia
    </body>
</html>
