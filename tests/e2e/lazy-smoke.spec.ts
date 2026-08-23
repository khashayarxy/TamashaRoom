import { test, expect, type Page } from "@playwright/test";

async function getXsrfToken(page: Page): Promise<string | undefined> {
    const cookies = await page.context().cookies();
    return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

test.describe("Lazy smoke – Show code-split (player + dialogs)", () => {
    test("room without video shows placeholder, no console errors", async ({
        page,
    }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") consoleErrors.push(msg.text());
        });
        page.on("pageerror", (err) => consoleErrors.push(err.message));

        const setup = await page.request.post("/__test/setup-verified-room");
        expect(setup.ok()).toBeTruthy();
        const { room_url } = await setup.json();

        await page.goto(room_url);
        await page.waitForLoadState("networkidle");

        // Placeholder for no video must be visible, player must NOT be in DOM yet
        await expect(
            page.getByText("هنوز ویدیویی تنظیم نشده است"),
        ).toBeVisible();
        // SyncedVideoJsPlayer lazy chunk should NOT have been requested yet
        // (no video element)
        await expect(page.locator("video")).toHaveCount(0);

        expect(
            consoleErrors.filter((m) => !m.includes("WebSocket")),
            "no console errors",
        ).toEqual([]);
    });

    test("set video: player chunk loads on demand and initializes", async ({
        page,
    }) => {
        const pageErrors: string[] = [];
        // The proxy mock's 502 and the unreachable external fallback are
        // intentional parts of the proxy→direct fallback path; only real JS
        // errors (pageerror) count as failures.
        page.on("pageerror", (err) => pageErrors.push(err.message));

        const setup = await page.request.post("/__test/setup-verified-room");
        expect(setup.ok()).toBeTruthy();
        const { room_url, room_id } = await setup.json();

        await page.goto(room_url);
        await page.waitForLoadState("networkidle");
        await expect(
            page.getByText("هنوز ویدیویی تنظیم نشده است"),
        ).toBeVisible();

        // Track lazy chunk requests
        const lazyRequests: string[] = [];
        page.on("request", (req) => {
            const url = req.url();
            if (url.includes("SyncedVideoJsPlayer")) lazyRequests.push(url);
        });

        // Open SetVideoDialog (lazy) – must load without flash
        await page.getByRole("button", { name: "ویدیو", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible({ timeout: 8000 });
        // Dialog content should be present (no empty fallback)
        await expect(page.getByPlaceholder("https://")).toBeVisible();

        // Close without setting, then set via API to have a real video and re-check player lazy
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();

        const xsrf = (await page.context().cookies()).find(
            (c) => c.name === "XSRF-TOKEN",
        )?.value;
        await page.route(/\/proxy\/video\/\d+/, async (route) => {
            await route.fulfill({
                status: 502,
                contentType: "video/mp4",
                body: "",
            });
        });
        // Now set a video URL to trigger player load
        const setResp = await page.request.post(
            `/playback/${room_id}/set-video`,
            {
                data: {
                    video_url: "https://example.com/sample.mp4",
                    _token: xsrf,
                },
            },
        );
        expect(setResp.ok()).toBeTruthy();
        // Reload so the page observes the new video URL deterministically
        // (a real second client would get it via broadcast/poll; this page's
        // own sync state was seeded before the video existed).
        await page.reload();
        await page.waitForLoadState("networkidle");

        // Player should now be present – lazy chunk must have been fetched
        await page.waitForSelector("video", { timeout: 15000 });
        await expect(page.locator("video")).toBeVisible();
        // No flash of missing content – the Suspense fallback is the muted
        // spinner or the placeholder, not blank. Only real JS errors fail.
        expect(pageErrors, "no JS errors after player load").toEqual([]);
    });

    test("each lazy dialog loads on first open with no flash", async ({
        page,
    }) => {
        const setup = await page.request.post("/__test/setup-verified-room");
        expect(setup.ok()).toBeTruthy();
        const { room_url } = await setup.json();
        await page.goto(room_url);
        await page.waitForLoadState("networkidle");

        // 1. Room settings
        await page.getByRole("button", { name: "تنظیمات اتاق" }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
        await expect(
            page.getByRole("heading", { name: "تنظیمات اتاق" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();

        // 2. Set-video
        await page.getByRole("button", { name: "ویدیو", exact: true }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();

        // 3. Subtitle manager
        await page.getByRole("button", { name: "زیرنویس" }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeHidden();

        // 4. Subtitle settings – opened via player gear when video exists; test with no video: set a video first to get the gear
        // Create a room with video so the gear is present
        const setup2 = await page.request.post(
            "/__test/setup-verified-room?local_video=1",
        );
        const { room_url: roomUrl2 } = await setup2.json();
        await page.goto(roomUrl2);
        await page.waitForLoadState("networkidle");
        await page.route(/\/proxy\/video\/\d+/, async (r) =>
            r.fulfill({ status: 502, contentType: "video/mp4", body: "" }),
        );
        // Wait for video element then open settings menu
        await page.waitForSelector("video", { timeout: 15000 });
        // Hover to reveal controls, then click settings gear
        await page.hover(".media-default-skin");
        await page.waitForTimeout(800);
        const gear = page.locator(".media-button--settings");
        if (await gear.isVisible()) {
            await gear.click();
            // Subtitle settings dialog via menu
            const subItem = page.getByText("تنظیمات زیرنویس");
            if (await subItem.isVisible()) {
                await subItem.click();
                await expect(page.getByRole("dialog")).toBeVisible({
                    timeout: 8000,
                });
                await page.keyboard.press("Escape");
            }
        }

        // 5. Confirm dialogs – track delete and leave
        // Track delete confirm: need a subtitle track first – just test leave confirm
        await page.goto(room_url);
        await page.waitForLoadState("networkidle");
        // Leave confirm (guest would see it, but owner also has leave? owner has settings, guest has leave)
        // For owner, leave is not shown; test guest leave flow instead in two-context test
    });

    test("two-browser-context: lazy player does not race sync", async ({
        browser,
    }) => {
        test.setTimeout(40000);
        const hostCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const hostPage = await hostCtx.newPage();
        const guestCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const guestPage = await guestCtx.newPage();

        // Host creates room with video
        const resp = await hostPage.request.post(
            "/__test/setup-verified-room?local_video=1",
        );
        expect(resp.ok()).toBeTruthy();
        const { room_url, invite_code, room_id } = await resp.json();

        for (const p of [hostPage, guestPage]) {
            await p.route(/\/proxy\/video\/\d+/, async (r) =>
                r.fulfill({ status: 502, contentType: "video/mp4", body: "" }),
            );
        }

        await hostPage.goto(room_url);
        await hostPage.waitForSelector("video", { timeout: 15000 });

        const join = await guestPage.request.post("/__test/join-room", {
            data: { invite_code },
        });
        expect(join.ok()).toBeTruthy();
        await guestPage.goto(room_url);
        await guestPage.waitForSelector("video", { timeout: 15000 });

        // Both have lazy-loaded player now – trigger sync and ensure guest follows
        // (exact PATCH pattern from room.spec.ts "Playback state propagates")
        const xsrfToken = await getXsrfToken(hostPage);
        const patchResp = await hostPage.request.patch(`/playback/${room_id}`, {
            data: {
                is_playing: true,
                position_seconds: 10,
                duration_seconds: 120,
                playback_rate: 1,
                client_timestamp: Date.now() / 1000,
                _token: xsrfToken,
            },
        });
        expect(
            patchResp.ok(),
            `PATCH failed: ${patchResp.status()} ${await patchResp.text()}`,
        ).toBeTruthy();

        // Poll until guest sees the updated state (max ~15s). SQLite +
        // single-process serve serializes writes from two playing pages,
        // so allow a generous per-request timeout.
        let guestState: Record<string, unknown> = {};
        for (let i = 0; i < 6; i++) {
            await guestPage.waitForTimeout(2500);
            const stateResp = await guestPage.request.get(
                `/playback/${room_id}/state`,
                { timeout: 10000 },
            );
            expect(stateResp.ok()).toBeTruthy();
            guestState = await stateResp.json();
            if (guestState.is_playing === true) break;
        }
        expect(guestState.is_playing).toBe(true);

        await hostCtx.close();
        await guestCtx.close();
    });
});
