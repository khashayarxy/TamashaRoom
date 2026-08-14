import { test, expect } from "@playwright/test";

test.describe("App load failure fallback (privacy / script blocking)", () => {
    test("1. Script onerror triggered (blocked bundle) -> immediate fallback", async ({
        page,
    }) => {
        // Block main application JavaScript bundle to trigger immediate script onerror
        await page.route("**/*app*.js", (route) => route.abort("failed"));

        const startTime = Date.now();
        await page.goto("/login");

        const fallback = page.locator("#tamasha-fallback");
        await expect(fallback).toBeVisible({ timeout: 2000 });

        const elapsed = Date.now() - startTime;
        // Confirms it appeared near-instantly (well below the 3.5s watchdog)
        expect(elapsed).toBeLessThan(3000);

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

    test("2. Bundle loads but app never mounts -> fallback via 3.5s watchdog", async ({
        page,
    }) => {
        // Serve a harmless script that does NOT mount the React app, without firing onerror
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

        // At 1.5s, the watchdog has not fired yet and no onerror occurred
        await page.waitForTimeout(1500);
        await expect(fallback).not.toBeVisible();

        // At > 3.5s, watchdog fires
        await expect(fallback).toBeVisible({ timeout: 4000 });
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(3200);

        await expect(
            fallback.getByRole("heading", { name: "خطا در بارگذاری برنامه" }),
        ).toBeVisible();
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
