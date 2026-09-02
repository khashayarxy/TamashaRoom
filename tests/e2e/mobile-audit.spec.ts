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

    test("chat input is visible on room page", async ({ page }) => {
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

    test("video player is present on room page", async ({ page }) => {
        const resp = await page.request.post(
            "/__test/setup-verified-room",
            { data: { with_video: "1" } },
        );
        const { room_url } = await resp.json();
        await page.goto(room_url);

        const player = page.locator("video, .vjs-tech, .vjs-big-play-button");
        await expect(player.first()).toBeVisible();
    });
});
