import { test, expect } from "@playwright/test";

test.describe("Mobile Audit - Responsive Layout", () => {
    test("landing page renders without horizontal scroll", async ({ page }) => {
        await page.goto("/");
        const scrollWidth = await page.evaluate(
            () => document.body.scrollWidth,
        );
        const clientWidth = await page.evaluate(
            () => document.documentElement.clientWidth,
        );
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test("landing page matches mobile snapshot", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveScreenshot("mobile-landing.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("room page renders without horizontal scroll", async ({ page }) => {
        const resp = await page.request.post(
            "/__test/setup-verified-room",
            { data: { with_video: "1" } },
        );
        const { room_url } = await resp.json();
        await page.goto(room_url);

        const scrollWidth = await page.evaluate(
            () => document.body.scrollWidth,
        );
        const clientWidth = await page.evaluate(
            () => document.documentElement.clientWidth,
        );
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test("room page matches mobile snapshot", async ({ page }) => {
        const resp = await page.request.post(
            "/__test/setup-verified-room",
            { data: { with_video: "1" } },
        );
        const { room_url } = await resp.json();
        await page.goto(room_url);
        await expect(page).toHaveScreenshot("mobile-room.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("chat input is visible on mobile", async ({ page }) => {
        const resp = await page.request.post(
            "/__test/setup-verified-room",
            { data: { with_video: "1" } },
        );
        const { room_url } = await resp.json();
        await page.goto(room_url);

        const chatInput = page.locator(
            '[data-testid="chat-panel"] input[type="text"], [data-testid="chat-panel"] textarea',
        );
        await expect(chatInput.first()).toBeVisible();
    });
});
