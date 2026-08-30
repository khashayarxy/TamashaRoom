<!DOCTYPE html>
<html lang="fa" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0A0A0F">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'تماشاروم') }}</title>

        <script @if(isset($cspNonce)) nonce="{{ $cspNonce }}" @endif>
            (function() {
                var fallbackReason = null;
                var fallbackTimer = null;
                // Grace before an entry-error fallback shows: transient asset
                // errors (LVE/Cloudflare 503 bursts) resolve while the bundle
                // still executes — the boot marker set at app.tsx module-eval
                // cancels the show. A genuinely blocked bundle never boots, so
                // it only delays the warning by this much.
                var ERROR_GRACE_MS = 1500;
                // Watchdog: the bundle never EXECUTED at all (blocked, hung,
                // or served a foreign body). Slow mounts are not a failure —
                // the marker is set at module-eval, long before React renders.
                var WATCHDOG_MS = 8000;

                function booted() {
                    return Boolean(window.__TAMASHAROOM_APP_BOOTED || window.__TAMASHA_MOUNTED__);
                }

                function applyFallback() {
                    if (!fallbackReason) return;
                    // Mounted = definitively alive; never show. Booted (bundle
                    // executed) absorbs TRANSIENT asset errors — but not the
                    // mount watchdog: a booted bundle that never renders (e.g.
                    // a lazy page chunk's hard CSS dependency failed through
                    // Vite's dep preloader) leaves a blank page, and that
                    // still deserves the fallback after the watchdog.
                    if (window.__TAMASHA_MOUNTED__) return;
                    if (
                        fallbackReason !== "timeout" &&
                        window.__TAMASHAROOM_APP_BOOTED
                    ) {
                        return;
                    }
                    if (fallbackTimer) clearTimeout(fallbackTimer);

                    var fb = document.getElementById("tamasha-fallback");
                    if (!fb) {
                        // Error fired before the body parsed — wait for the
                        // element, but never bypass the grace timer.
                        document.addEventListener(
                            "DOMContentLoaded",
                            applyFallback,
                            { once: true },
                        );
                        return;
                    }

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

                function showFallback(reason, immediate) {
                    if (booted() || fallbackReason) return;
                    fallbackReason = reason;
                    if (fallbackTimer) clearTimeout(fallbackTimer);
                    // The grace timer is the ONLY scheduling path — a
                    // DOMContentLoaded handler must not apply the fallback
                    // early, or every parse-time error would flash the banner
                    // before the grace window could absorb it.
                    fallbackTimer = setTimeout(applyFallback, immediate ? 0 : ERROR_GRACE_MS);
                }

                // 1. Error listener for the core application bundle. Never shows
                // immediately: match only TamashaRoom's own entry chunk (never
                // generic type="module" scripts — third-party ones like the
                // Cloudflare Insights beacon fail on many setups), then let the
                // grace window decide.
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

                // 2. Watchdog as secondary safety net for silent stalls. Keys
                // on the MOUNT marker, not the boot marker: a bundle that
                // executed but never rendered (e.g. a lazy page chunk's hard
                // CSS dependency failed through Vite's dep preloader) is a
                // blank page and must not outlive this watchdog. It bypasses
                // showFallback's booted-gate on purpose.
                fallbackTimer = setTimeout(function() {
                    if (!window.__TAMASHA_MOUNTED__) {
                        fallbackReason = "timeout";
                        fallbackTimer = setTimeout(applyFallback, 0);
                    }
                }, WATCHDOG_MS);

                window.__tamashaClearFallbackTimer = function() {
                    if (fallbackTimer) clearTimeout(fallbackTimer);
                    var fb = document.getElementById("tamasha-fallback");
                    if (fb && fb.parentNode) {
                        fb.parentNode.removeChild(fb);
                    }
                };

                document.addEventListener("DOMContentLoaded", function() {
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
        @include('partials.noscript')
        @include('partials.fallback')

        @inertia
    </body>
</html>

