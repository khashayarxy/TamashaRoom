<!DOCTYPE html>
<html lang="fa" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0A0A0F">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'تماشاروم') }}</title>

        <link rel="preload" as="font" type="font/woff2" href="{{ asset('build/assets/Vazirmatn-Medium-D86t5Axy.woff2') }}" crossorigin="anonymous">

        <script @if(isset($cspNonce)) nonce="{{ $cspNonce }}" @endif>
            (function() {
                var fallbackReason = null;
                var fallbackTimer = null;

                function applyFallback() {
                    if (window.__TAMASHA_MOUNTED__ || !fallbackReason) return;
                    if (fallbackTimer) clearTimeout(fallbackTimer);

                    var fb = document.getElementById("tamasha-fallback");
                    if (!fb) return;

                    var titleEl = document.getElementById("tamasha-fallback-title");
                    var descEl = document.getElementById("tamasha-fallback-desc");

                    if (fallbackReason === "blocked") {
                        if (titleEl) titleEl.textContent = "مسدود شدن فایل‌های اصلی برنامه";
                        if (descEl) descEl.textContent = "فایل اصلی برنامه توسط مرورگر، افزونه‌های مسدودکننده اسکریپت یا تنظیمات امنیتی مسدود شد و امکان بارگذاری نیافت.";
                    } else {
                        if (titleEl) titleEl.textContent = "خطا در بارگذاری برنامه";
                        if (descEl) descEl.textContent = "به نظر می‌رسد فایل‌های اجرایی برنامه به دلیل تنظیمات سخت‌گیرانه حریم خصوصی مرورگر (مانند Enhanced Tracking Protection) یا اختلال شبکه متوقف شده‌اند.";
                    }

                    fb.style.display = "flex";
                }

                function showFallback(reason) {
                    if (window.__TAMASHA_MOUNTED__ || fallbackReason) return;
                    fallbackReason = reason;
                    if (document.getElementById("tamasha-fallback")) {
                        applyFallback();
                    } else {
                        document.addEventListener("DOMContentLoaded", applyFallback);
                    }
                }

                // 1. Immediate error listener for the core application bundle (0ms)
                // Match only TamashaRoom's own entry chunk, never generic type="module"
                // scripts (third-party ones like the Cloudflare Insights beacon fail on
                // many setups and must not flash the blocker warning).
                window.addEventListener("error", function(event) {
                    var target = event.target;
                    if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
                        var src = target.src || target.href || "";
                        if (
                            src.indexOf("/build/assets/app") !== -1 ||  // production entry (js/css/preload)
                            src.indexOf("@@vite/") !== -1 ||            // dev HMR client / refresh
                            src.indexOf("/resources/js/app") !== -1     // dev entry source
                        ) {
                            showFallback("blocked");
                        }
                    }
                }, true);

                // 2. Watchdog timer as secondary safety net for silent stalls (3.5s)
                var fallbackTimeout = 3500;
                fallbackTimer = setTimeout(function() {
                    if (!window.__TAMASHA_MOUNTED__) {
                        showFallback("timeout");
                    }
                }, fallbackTimeout);

                window.__tamashaClearFallbackTimer = function() {
                    if (fallbackTimer) clearTimeout(fallbackTimer);
                    var fb = document.getElementById("tamasha-fallback");
                    if (fb && fb.parentNode) {
                        fb.parentNode.removeChild(fb);
                    }
                };

                document.addEventListener("DOMContentLoaded", function() {
                    if (fallbackReason) {
                        applyFallback();
                    }
                    var reloadBtn = document.getElementById("tamasha-reload-btn");
                    if (reloadBtn) {
                        reloadBtn.addEventListener("click", function() {
                            window.location.reload();
                        });
                    }
                });
            })();
        </script>

        @routes(nonce: $cspNonce ?? null)
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased {{ $themeClass ?? '' }}">
        <noscript>
            <div style="position: fixed; inset: 0; z-index: 999999; background: #0A0A0F; color: #F3F3F7; font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; display: flex; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;">
                <div style="max-width: 28rem; width: 100%; margin: auto; background: #13131A; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 1rem; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); text-align: center; box-sizing: border-box;">
                    <div style="width: 3.5rem; height: 3.5rem; margin: 0 auto 1.25rem; border-radius: 9999px; background: rgba(239, 68, 68, 0.15); display: flex; align-items: center; justify-content: center; color: #F87171; font-size: 1.75rem; line-height: 1;">
                        ⚠️
                    </div>
                    <h1 style="font-size: 1.125rem; font-weight: 700; margin: 0 0 0.75rem; color: #FFFFFF;">
                        جاوااسکریپت غیرفعال است
                    </h1>
                    <p style="font-size: 0.875rem; line-height: 1.6; color: #A1A1AA; margin: 0 0 1.25rem; text-align: right;">
                        برای استفاده از تماشاروم و امکان تماشای هماهنگ ویدیو، فعال بودن جاوااسکریپت در مرورگر الزامی است. لطفاً جاوااسکریپت مرورگر خود را فعال کرده و صفحه را مجدداً بارگذاری کنید.
                    </p>
                </div>
            </div>
        </noscript>

        <div id="tamasha-fallback" style="display: none; position: fixed; inset: 0; z-index: 999999; background: #0A0A0F; color: #F3F3F7; font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;">
            <div style="max-width: 28rem; width: 100%; margin: auto; background: #13131A; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 1rem; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); text-align: center; box-sizing: border-box;">
                <div style="width: 3.5rem; height: 3.5rem; margin: 0 auto 1.25rem; border-radius: 9999px; background: rgba(239, 68, 68, 0.15); display: flex; align-items: center; justify-content: center; color: #F87171; font-size: 1.75rem; line-height: 1;">
                    ⚠️
                </div>
                <h1 id="tamasha-fallback-title" style="font-size: 1.125rem; font-weight: 700; margin: 0 0 0.75rem; color: #FFFFFF;">
                    خطا در بارگذاری برنامه
                </h1>
                <p id="tamasha-fallback-desc" style="font-size: 0.875rem; line-height: 1.6; color: #A1A1AA; margin: 0 0 1.25rem; text-align: right;">
                    به نظر می‌رسد فایل‌های اجرایی برنامه به دلیل تنظیمات سخت‌گیرانه حریم خصوصی مرورگر (مانند Enhanced Tracking Protection) یا اختلال شبکه متوقف شده‌اند.
                </p>
                <div style="background: rgba(255, 255, 255, 0.04); border-radius: 0.75rem; padding: 1rem; margin-bottom: 1.25rem; text-align: right; font-size: 0.8125rem; line-height: 1.6; color: #D4D4D8;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem; color: #FAFAFA;">راهنمای رفع مشکل:</div>
                    <ol style="margin: 0; padding-right: 1.25rem; padding-left: 0;">
                        <li style="margin-bottom: 0.35rem;">سطح محافظت از ردیابی مرورگر (Tracking Protection) را برای این سایت کاهش دهید یا غیرفعال کنید.</li>
                        <li>آدرس این سایت را به لیست استثنائات (Exceptions / Allowlist) مرورگر خود اضافه نمایید.</li>
                    </ol>
                </div>
                <button type="button" id="tamasha-reload-btn" style="background: #4F46E5; color: #FFFFFF; border: none; border-radius: 0.5rem; padding: 0.625rem 1.5rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; font-family: inherit; width: 100%;">
                    تلاش مجدد
                </button>
            </div>
        </div>

        @inertia
    </body>
</html>

