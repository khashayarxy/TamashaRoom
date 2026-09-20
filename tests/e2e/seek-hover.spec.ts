import { test, expect, type Page } from "@playwright/test";

/**
 * Seek hover marker geometry.
 *
 * The Video.js skin renders the hover dot as `.media-slider__preview::before`,
 * centered in the preview box — but that box is position-clamped to keep the
 * time label inside the player, so the dot stuck at the clamp bounds near
 * both bar ends (±12-17% off). The app hides the skin dot and renders
 * `.media-slider__pointer` instead, positioned by the raw pointer var across
 * the full 0-100% range.
 *
 * The label had the same disease one layer up: the preview box reserved a
 * 192px thumbnail slot (`min-width: var(--max-size)`) with no thumbnail
 * shown, freezing the label across the outer ~17% at each end. The app
 * drops that floor (`min-width: 0`), so the JS clamp uses the label's own
 * half-width (~10px) and the label stays centered on the dot almost to the
 * edges without ever leaving the player.
 *
 * See: resources/css/app.css ("Seek hover dot/label"), VideoJsPlayer.tsx.
 */
async function installProxyFallbackMock(page: Page): Promise<void> {
    await page.route(/\/proxy\/video\/\d+/, async (route) => {
        await route.fulfill({
            status: 502,
            contentType: "video/mp4",
            body: "",
        });
    });
}

test.describe("Seek hover marker", () => {
    test("dot tracks the pointer across the bar while the label stays clamped", async ({
        page,
    }) => {
        test.setTimeout(90000);
        await installProxyFallbackMock(page);
        const resp = await page.request.post(
            "/__test/setup-verified-room?local_video=1",
        );
        expect(resp.ok()).toBeTruthy();
        const { room_url } = await resp.json();
        await page.goto(room_url, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("video");

        // Reveal the auto-hiding control bar.
        const videoBox = await page.locator("video").boundingBox();
        expect(videoBox).not.toBeNull();
        await page.mouse.move(
            videoBox!.x + videoBox!.width / 2,
            videoBox!.y + videoBox!.height / 2,
        );
        await page.waitForSelector(".media-controls--root[data-visible]");

        const barEl = page.locator(".media-time-controls .media-slider");
        await expect(barEl).toBeVisible();
        const bar = await barEl.boundingBox();
        expect(bar).not.toBeNull();

        // The skin's clamped dot must stay hidden.
        const skinDotDisplay = await page.evaluate(() => {
            const preview = document.querySelector(
                ".media-slider__preview",
            ) as HTMLElement | null;
            if (!preview) return null;
            return getComputedStyle(preview, "::before").display;
        });
        expect(skinDotDisplay).toBe("none");

        for (const frac of [0.02, 0.05, 0.5, 0.95, 0.98]) {
            await page.mouse.move(
                bar!.x + frac * bar!.width,
                bar!.y + bar!.height / 2,
            );
            await page.waitForTimeout(350);
            const m = await page.evaluate(() => {
                const dot = document.querySelector(
                    ".media-slider__pointer",
                ) as HTMLElement | null;
                const label = document.querySelector(
                    ".media-slider__value",
                ) as HTMLElement | null;
                if (!dot || !label) return null;
                const d = dot.getBoundingClientRect();
                const l = label.getBoundingClientRect();
                return {
                    dotCenterX: d.x + d.width / 2,
                    dotOpacity: getComputedStyle(dot).opacity,
                    labelCX: l.x + l.width / 2,
                    labelX: l.x,
                    labelW: l.width,
                    labelText: label.textContent?.trim() ?? "",
                };
            });
            expect(m).not.toBeNull();
            const expectedX = bar!.x + frac * bar!.width;
            // Generous tolerance: the pre-fix dot was 12-17% off at the ends.
            expect(Math.abs(m!.dotCenterX - expectedX)).toBeLessThanOrEqual(
                bar!.width * 0.02,
            );
            expect(m!.dotOpacity).toBe("1");
            // The label stays centered on the dot, clamped only by its own
            // half-width: expected position is the pointer, pulled inside
            // the bar by half the label width at the edges.
            const halfW = m!.labelW / 2;
            const relX = expectedX - bar!.x;
            const clampedRelX = Math.min(
                Math.max(halfW, relX),
                bar!.width - halfW,
            );
            expect(
                Math.abs(m!.labelCX - (bar!.x + clampedRelX)),
            ).toBeLessThanOrEqual(bar!.width * 0.02);
            // ...while still showing the pointer-derived value.
            expect(m!.labelText.length).toBeGreaterThan(0);
        }
    });
});
