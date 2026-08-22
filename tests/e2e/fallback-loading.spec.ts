import { test, expect } from "@playwright/test";

test.describe("App load failure fallback (privacy / script blocking)", () => {
    test("1. Script onerror triggered (blocked bundle) -> fallback after the grace window", async ({
        page,
    }) => {
        // Block main application JavaScript bundle to trigger script onerror.
        // The bundle can never boot, so after the ~1.5s error grace the
        // fallback must show — but never instantly (no flash on transients).
        await page.route("**/*app*.js", (route) => route.abort("failed"));

        const startTime = Date.now();
        await page.goto("/login");

        const fallback = page.locator("#tamasha-fallback");

        // Inside the grace window: not visible yet.
        await page.waitForTimeout(700);
        await expect(fallback).not.toBeVisible();

        await expect(fallback).toBeVisible({ timeout: 4000 });
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(1400);

        await expect(
            fallback.getByRole("heading", {
                name: "مسدود شدن فایل‌های اصلی برنامه",
            }),
        ).toBeVisible();
        await expect(
            fallback.getByText("فایل اصلی برنامه توسط مرورگر"),
        ).toBeVisible();
        await expect(
            fallback.getByRole("button", { name: "تلاش مجدد" }),
        ).toBeVisible();
    });

    test("2. Bundle loads but app never boots -> fallback via 8s watchdog", async ({
        page,
    }) => {
        // Serve a harmless script that does NOT evaluate the real app (so the
        // boot marker never appears), without firing onerror.
        await page.route("**/*app*.js", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/javascript",
                body: "console.log('Dummy non-mounting script loaded successfully');",
            });
        });

        const startTime = Date.now();
        await page.goto("/login");

        const fallback = page.locator("#tamasha-fallback");

        // At 4.5s (past the old 3.5s watchdog), still nothing — slow mounts
        // must not flash the warning.
        await page.waitForTimeout(4500);
        await expect(fallback).not.toBeVisible();

        // At > 8s, watchdog fires.
        await expect(fallback).toBeVisible({ timeout: 6000 });
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(7500);

        await expect(
            fallback.getByRole("heading", { name: "خطا در بارگذاری برنامه" }),
        ).toBeVisible();
    });

    test("2b. Transient entry preload error, bundle still boots -> no fallback flash", async ({
        page,
    }) => {
        // Simulate the LVE/Cloudflare 503-burst class: the entry's CSS preload
        // fails once while the JS bundle itself loads and boots fine. The
        // grace window must absorb the error and never show the fallback.
        // Diagnostics (CI-only debugging aid for the mount stall): collect
        // console/pageerror/failed-asset evidence into the failure message.
        const diagnostics: string[] = [];
        page.on("console", (m) => {
            if (["error", "warning"].includes(m.type()))
                diagnostics.push(`console.${m.type()}: ${m.text().slice(0, 200)}`);
        });
        page.on("pageerror", (e) => diagnostics.push(`pageerror: ${String(e).slice(0, 300)}`));
        page.on("requestfailed", (r) => {
            if (r.url().includes("/build/"))
                diagnostics.push(
                    `asset-failed: ${r.url().split("/").pop()} ${r.failure()?.errorText}`,
                );
        });

        await page.route("**/*app*.css", (route) => route.abort("failed"));

        await page.goto("/login");
        await page.waitForLoadState("networkidle");

        const mounted = page.locator("html");
        try {
            // CI's cold serve can take longer than the default 5s to mount;
            // the point of this test is the no-flash outcome, not mount speed.
            await expect(mounted).toHaveAttribute("data-app-mounted", "true", {
                timeout: 15000,
            });
        } catch (e) {
            const state = await page
                .evaluate(() => ({
                    booted: Boolean(window.__TAMASHAROOM_APP_BOOTED),
                    marker: Boolean(window.__TAMASHA_MOUNTED__),
                    fallbackVisible:
                        document.getElementById("tamasha-fallback")?.style.display ??
                        "n/a",
                    appDiv: Boolean(document.getElementById("app")),
                    scripts: [...document.querySelectorAll("script[src]")].map((s) =>
                        s.src.split("/").pop(),
                    ),
                }))
                .catch(() => null);
            throw new Error(
                `mount stall. pageState=${JSON.stringify(state)} diagnostics=${JSON.stringify(diagnostics.slice(0, 15))} :: ${e}`,
            );
        }

        // Give any would-be flash (1.5s grace expiry) ample time to appear.
        await page.waitForTimeout(3000);
        const fallback = page.locator("#tamasha-fallback");
        await expect(fallback).not.toBeVisible();
    });

    test("3. Slow-but-successful load -> app mounts normally, no fallback shown", async ({
        page,
    }) => {
        // Delay bundle response by 1 second (simulating slow network)
        await page.route("**/*app*.js", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await route.continue();
        });

        await page.goto("/login");
        await page.waitForLoadState("networkidle");

        // React app mounts successfully
        await expect(page.locator("html")).toHaveAttribute(
            "data-app-mounted",
            "true",
        );

        // Fallback element is never visible
        const fallback = page.locator("#tamasha-fallback");
        await expect(fallback).not.toBeVisible();
    });

    test("4. Pusher/WebSocket blocked -> no fallback shown (silent HTTP fallback)", async ({
        page,
    }) => {
        // Block external WebSocket / Pusher traffic
        await page.route(/.*pusher.*|wss?:.*/, (route) => route.abort());

        await page.goto("/login");
        await page.waitForLoadState("networkidle");

        // React app mounts and functions normally without triggering any fallback
        await expect(page.locator("html")).toHaveAttribute(
            "data-app-mounted",
            "true",
        );
        const fallback = page.locator("#tamasha-fallback");
        await expect(fallback).not.toBeVisible();
    });
});
