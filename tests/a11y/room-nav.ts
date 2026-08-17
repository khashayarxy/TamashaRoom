import type { Page } from "@playwright/test";

/**
 * Make the room fixture's video source load successfully in tests.
 *
 * The a11y room fixture is created with `with_video=1`, which stores
 * `video_url = https://www.example.com/video.mp4` in proxy mode, so the player
 * requests `/proxy/video/{room}`. Under CI's single-process `php artisan serve`
 * that proxy self-requests the same server and stalls; Video.js then raises a
 * media-error dialog that keeps re-opening (clicking its close button detaches
 * and re-creates it), and the skin forces the control bar to
 * `visibility: hidden` while it is open. Fulfill the proxy route with a real,
 * playable fixture instead so the media loads, no error dialog ever appears,
 * and the control bar stays reachable. Mirrors `installProxyFallbackMock` in
 * the e2e specs (which fulfills 502 to trigger the direct-mode fallback).
 */
function installPlayableVideoMock(page: Page): void {
    page.route(/\/proxy\/video\/\d+/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "video/mp4",
            path: "public/videos/sample.mp4",
        });
    });
}

/**
 * Deterministic room-page readiness. A room page with a video + live polling
 * never reaches `networkidle` (media fetches, playback-sync polls, presence
 * heartbeats), so waiting for the network to settle after navigation is
 * load-dependent and can time out before the tab-bar buttons render. The tab
 * bar ("چت"/"اعضا") is part of the first paint, so waiting on it is the
 * correct barrier — axe scans the DOM, it does not need the network settled.
 */
async function waitForRoom(page: Page): Promise<void> {
    await page.getByRole("button", { name: "چت" }).waitFor({ timeout: 20_000 });
}

/**
 * Setup-then-enter-room navigation with one retry for the stale-session race.
 *
 * The setup route logs the test user in, and Auth::login() regenerates the
 * session ID. A room page's in-flight playback-sync/presence poll carrying the
 * pre-regeneration session ID can be processed AFTER that regeneration and
 * resurrect the stale ID as an empty guest session; that response's Set-Cookie
 * overwrites the browser's fresh authenticated session cookie, so the next room
 * navigation 302s to /login. Retrying the navigation once (no room page alive
 * to fire racing polls) re-authenticates and lands on the room.
 */
export async function gotoRoom(
    page: Page,
    params: URLSearchParams,
): Promise<void> {
    installPlayableVideoMock(page);
    const setup = async (): Promise<string> => {
        await page.goto("/__test/setup-verified-room?" + params.toString());
        await page.waitForLoadState("networkidle");
        const data = JSON.parse(
            await page.evaluate(() => document.body.innerText),
        );
        return new URL(data.room_url).pathname;
    };

    await page.goto(await setup());
    if (new URL(page.url()).pathname === "/login") {
        await page.goto(await setup());
    }
    await waitForRoom(page);
}