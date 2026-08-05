<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>۴۰۴ — صفحه پیدا نشد | {{ config('app.name', 'تماشاروم') }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            direction: rtl;
        }
        .container { text-align: center; padding: 2rem; }
        h1 { font-size: 6rem; font-weight: 800; color: #3b82f6; line-height: 1; }
        p { font-size: 1.125rem; margin: 1rem 0 2rem; color: #94a3b8; }
        a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #3b82f6;
            color: #fff;
            border-radius: 0.75rem;
            text-decoration: none;
            font-weight: 500;
            transition: opacity 0.2s;
        }
        a:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <h1>۴۰۴</h1>
        <p>صفحه‌ای که دنبال آن بودید پیدا نشد.</p>
        <a href="{{ url('/') }}">بازگشت به صفحه اصلی</a>
    </div>
</body>
</html>
