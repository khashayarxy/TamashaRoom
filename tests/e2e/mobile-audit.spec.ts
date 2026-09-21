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

    test("chat panel fills available height without dead zone or page scroll", async ({
        page,
    }) => {
        const resp = await page.request.post(
            "/__test/setup-verified-room",
            { data: { with_video: "1" } },
        );
        const { room_url } = await resp.json();
        await page.goto(room_url);
        await page.waitForSelector('[data-testid="chat-panel"]');

        const innerH = await page.evaluate(() => window.innerHeight);
        const scrollH = await page.evaluate(
            () => document.documentElement.scrollHeight,
        );
        const layoutBox = await page.getByTestId("room-layout").boundingBox();
        const chatBox = await page.getByTestId("chat-panel").boundingBox();
        expect(layoutBox).not.toBeNull();
        expect(chatBox).not.toBeNull();

        const layoutBottom = layoutBox!.y + layoutBox!.height;
        const chatBottom = chatBox!.y + chatBox!.height;

        // BUG 5 regression guard (vertical): the room must never scroll page.
        expect(scrollH).toBeLessThanOrEqual(innerH + 1);
        // The container fills to AppLayout's bottom padding (py-8 = 32px):
        // the old 8.5rem estimate left a ~39px dead zone under the chat card.
        expect(layoutBottom).toBeGreaterThanOrEqual(innerH - 40);
        expect(layoutBottom).toBeLessThanOrEqual(innerH - 28);
        // The chat panel stretches to the container bottom (no inner gap).
        expect(chatBottom).toBeGreaterThanOrEqual(layoutBottom - 4);
        expect(chatBottom).toBeLessThanOrEqual(layoutBottom);
    });
});
