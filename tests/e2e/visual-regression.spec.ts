import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
    test('landing page matches snapshot', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveScreenshot('landing.png', {
            maxDiffPixelRatio: 0.01,
        });
    });

    test('room page matches snapshot', async ({ page }) => {
        const resp = await page.request.post('/__test/setup-verified-room', {
            data: { with_video: '1' },
        });
        const { room_url } = await resp.json();
        await page.goto(room_url);
        await expect(page).toHaveScreenshot('room.png', {
            maxDiffPixelRatio: 0.01,
        });
    });

    test('chat panel matches snapshot', async ({ page }) => {
        const resp = await page.request.post('/__test/setup-verified-room', {
            data: { with_video: '1' },
        });
        const { room_url } = await resp.json();
        await page.goto(room_url);
        await expect(page.locator('[data-testid="chat-panel"]')).toHaveScreenshot('chat.png');
    });
});
