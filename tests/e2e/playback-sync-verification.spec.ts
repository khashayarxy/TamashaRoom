import { test, expect, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verification for commit "fix: playback sync drift extrapolation + out-of-order
 * PATCH guard" (originally 4487788, now d6b6390).
 *
 * These tests drive the REAL UI (host/guest pages) against the real dev server
 * and real polling hook — no mocked API. The out-of-order test intercepts real
 * PATCH responses via Playwright route interception and reorders their
 * delivery, exactly the scenario the version guard protects against.
 *
 * The room uses the test-helper's `local_video` branch (same-origin media,
 * playback_mode=direct) so the browser can actually play the video.
 */

// Poll cadence is 3s while playing and a drift correction only triggers past
// DRIFT_THRESHOLD (=2s). Max steady-state error is host-sync latency plus up
// to one poll interval — ~3-5s observed in practice (worst-case just over 5s).
// 7s is the intended tolerance: it still distinguishes a healthy sync from a
// real desync, which is tens of seconds (like the old 63s regression).
const DRIFT_TOLERANCE = 7;

const VIDEOS_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../public/videos",
);

/**
 * `php artisan serve` (PHP built-in server) does NOT honor HTTP Range
 * requests — it always answers 200 with the full body. Chromium's media stack
 * relies on Range to seek past the initial buffered span, so playback-sync
 * drift correction (which seeks) can never converge against the raw dev
 * server. Production is cPanel Apache, which DOES support Range. This mock
 * replicates that contract for the E2E suite so the tests exercise the same
 * seeking behavior users get in production.
 */
async function installRangeMock(page: Page): Promise<void> {
    await page.route(/\/videos\/.+\.(webm|mp4)$/i, async (route) => {
        const url = new URL(route.request().url());
        const file = path.join(VIDEOS_DIR, path.basename(url.pathname));
        const data = fs.readFileSync(file);
        const size = data.length;
        const mime = url.pathname.toLowerCase().endsWith(".webm")
            ? "video/webm"
            : "video/mp4";
        if (route.request().method() === "HEAD") {
            await route.fulfill({
                status: 200,
                headers: { "Content-Type": mime, "Accept-Ranges": "bytes" },
            });
            return;
        }
        const range = route.request().headers()["range"];
        if (range) {
            const m = /bytes=(\d+)-(\d*)/.exec(range);
            if (m) {
                const start = parseInt(m[1], 10);
                const end = m[2] ? parseInt(m[2], 10) : size - 1;
                await route.fulfill({
                    status: 206,
                    contentType: mime,
                    headers: {
                        "Content-Range": `bytes ${start}-${end}/${size}`,
                        "Accept-Ranges": "bytes",
                    },
                    body: data.subarray(start, end + 1),
                });
                return;
            }
        }
        await route.fulfill({
            status: 200,
            contentType: mime,
            headers: { "Accept-Ranges": "bytes" },
            body: data,
        });
    });
}

async function createLocalRoom(page: Page): Promise<{
    room_url: string;
    room_id: number;
    invite_code: string;
}> {
    await installRangeMock(page);
    // sync-sample.webm is a ~95s fixture (public/videos) long enough to survive
    // the full host-advances-60s window in test 2.2 without hitting the end.
    const resp = await page.request.post(
        "/__test/setup-verified-room?local_video=1&video_file=sync-sample.webm",
    );
    expect(resp.ok()).toBeTruthy();
    return await resp.json();
}

async function joinAsGuest(page: Page, inviteCode: string): Promise<void> {
    await installRangeMock(page);
    // force_new=1: without it the helper logs the "guest" page in as the room
    // OWNER (a second host, canControl=true) — two PATCHers then fight each
    // other and the host video gets yanked back. A real guest must be a
    // distinct, non-controlling user.
    const resp = await page.request.post("/__test/join-room?force_new=1", {
        data: { invite_code: inviteCode },
    });
    expect(resp.ok()).toBeTruthy();
}

async function videoTime(page: Page): Promise<number> {
    return page.evaluate(
        () => document.querySelector("video")?.currentTime ?? 0,
    );
}

async function videoInfo(page: Page): Promise<{
    currentTime: number;
    paused: boolean;
    error: boolean;
}> {
    return page.evaluate(() => {
        const v = document.querySelector("video");
        // The sync error banner is bg-destructive/90 (see SyncedVideoJsPlayer).
        // Plain bg-destructive is the ConfirmDialog delete button — not a
        // sync error.
        const errorBanner = !!document.querySelector(
            '[class*="bg-destructive/90"]',
        );
        return {
            currentTime: v?.currentTime ?? 0,
            paused: v?.paused ?? true,
            error: errorBanner,
        };
    });
}

/**
 * The browser blocks unmuted autoplay without a prior gesture (loopback is not
 * exempt for this Chromium build), so both host and guest need one real click
 * to start. This toggles the v10 play button until the video is actually
 * advancing, mirroring how a real user starts playback.
 *
 * Video.js v10's play button has a stable selector (button.media-button--play)
 * whose aria-label flips between "پخش" and "مکث", so the label is not a stable
 * locator — the class always is. The controls are pointer-events:none while
 * idle, so the click is dispatched synchronously via JS (the same pattern as
 * startPlayback below) rather than a pointer click that races the fade-out.
 */
async function ensurePlaying(page: Page): Promise<boolean> {
    for (let i = 0; i < 5; i++) {
        const s = await videoInfo(page);
        if (!s.paused && s.currentTime > 0) return true;
        const pb = page.locator("button.media-button--play");
        if ((await pb.count()) > 0) {
            await pb.evaluate((el) => (el as HTMLButtonElement).click());
            await page.waitForTimeout(1500);
        }
    }
    const s = await videoInfo(page);
    return !s.paused && s.currentTime > 0;
}

/** Force document.hidden + visibilitychange (the hook reads both). */
async function setTabHidden(page: Page, hidden: boolean): Promise<void> {
    await page.evaluate((h) => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => h,
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => (h ? "hidden" : "visible"),
        });
        document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
}

/**
 * Dismiss the "شروع پخش" autoplay-block overlay if present. The button is
 * re-created on every poll-driven re-render, so a normal pointer `click()`
 * races with React detaching the node (a source of E2E flake). Dispatch the
 * click synchronously on the current node instead.
 */
async function startPlayback(page: Page): Promise<void> {
    const overlay = page.getByRole("button", { name: "شروع پخش" });
    if ((await overlay.count()) > 0) {
        await overlay.evaluate((el) => (el as HTMLButtonElement).click());
        await page.waitForTimeout(500);
    }
}

/**
 * The polling hook fetches continuously, so `waitForLoadState("networkidle")`
 * never settles. Wait for the room page's real media element to be mounted and
 * to have a known, finite duration instead.
 */
async function waitForVideo(page: Page): Promise<void> {
    await page.waitForSelector("video", { timeout: 15000 });
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const v = document.querySelector("video");
                    return v && Number.isFinite(v.duration) && v.duration > 0
                        ? v.duration
                        : 0;
                }),
            { timeout: 15000 },
        )
        .toBeGreaterThan(0);
}

test.describe("Playback sync drift + out-of-order PATCH guard", () => {
    test("2.1 host starts playback, guest joins, positions sync within drift tolerance", async ({
        browser,
    }) => {
        test.setTimeout(90000);

        const hostCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const host = await hostCtx.newPage();
        const room = await createLocalRoom(host);

        await host.goto(room.room_url);
        await waitForVideo(host);
        expect(await ensurePlaying(host)).toBe(true);
        await host.waitForTimeout(2500);

        const guestCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const guest = await guestCtx.newPage();
        await joinAsGuest(guest, room.invite_code);
        await guest.goto(room.room_url);
        await waitForVideo(guest);
        await guest.waitForTimeout(1500);
        await startPlayback(guest);
        expect(await ensurePlaying(guest)).toBe(true);

        // Both playing; the guest's polling should keep it within drift tolerance
        // of the host. Wait for convergence.
        await expect
            .poll(
                async () => {
                    const h = await videoTime(host);
                    const g = await videoTime(guest);
                    return Math.abs(g - h);
                },
                { timeout: 30000 },
            )
            .toBeLessThanOrEqual(DRIFT_TOLERANCE);

        const hostT = await videoTime(host);
        const guestT = await videoTime(guest);
        console.log(
            `2.1 sync: host=${hostT.toFixed(2)}s guest=${guestT.toFixed(2)}s diff=${Math.abs(hostT - guestT).toFixed(2)}s`,
        );

        // No error banner on either page.
        expect((await videoInfo(host)).error).toBe(false);
        expect((await videoInfo(guest)).error).toBe(false);

        await hostCtx.close();
        await guestCtx.close();
    });

    test("2.2 guest backgrounded 60s corrects to owner's CURRENT position on return", async ({
        browser,
    }) => {
        test.setTimeout(120000);

        const hostCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const host = await hostCtx.newPage();
        const room = await createLocalRoom(host);
        await host.goto(room.room_url);
        await waitForVideo(host);
        expect(await ensurePlaying(host)).toBe(true);
        await host.waitForTimeout(1500);

        const guestCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const guest = await guestCtx.newPage();
        await joinAsGuest(guest, room.invite_code);
        await guest.goto(room.room_url);
        await waitForVideo(guest);
        await guest.waitForTimeout(1500);
        await startPlayback(guest);
        expect(await ensurePlaying(guest)).toBe(true);

        // Converge first.
        await expect
            .poll(
                async () => {
                    const h = await videoTime(host);
                    const g = await videoTime(guest);
                    return Math.abs(g - h);
                },
                { timeout: 30000 },
            )
            .toBeLessThanOrEqual(DRIFT_TOLERANCE);

        const preHideGuest = await videoTime(guest);
        console.log(`2.2 pre-hide: guest at ${preHideGuest.toFixed(2)}s`);

        // Background the guest tab. Polling pauses (fetchState short-circuits).
        await setTabHidden(guest, true);
        await guest.waitForTimeout(1000);

        // Owner keeps playing through ~60s while the guest is backgrounded.
        const hostAtHide = await videoTime(host);
        await host.waitForTimeout(60000);
        const hostAtRestore = await videoTime(host);
        console.log(
            `2.2 during background: host advanced ${hostAtHide.toFixed(2)}s -> ${hostAtRestore.toFixed(2)}s`,
        );
        expect(hostAtRestore - hostAtHide).toBeGreaterThan(40);

        // Bring the guest back: fetchState must run immediately and correct.
        await setTabHidden(guest, false);

        await expect
            .poll(
                async () => {
                    const h = await videoTime(host);
                    const g = await videoTime(guest);
                    return { g, h, diff: Math.abs(g - h) };
                },
                { timeout: 20000 },
            )
            .toEqual(expect.objectContaining({ diff: expect.any(Number) }));

        const guestAfter = await videoTime(guest);
        const hostAfter = await videoTime(host);
        const diffAfter = Math.abs(guestAfter - hostAfter);
        console.log(
            `2.2 after restore: guest=${guestAfter.toFixed(2)}s host=${hostAfter.toFixed(2)}s diff=${diffAfter.toFixed(2)}s`,
        );
        expect(diffAfter).toBeLessThanOrEqual(DRIFT_TOLERANCE);
        expect(guestAfter).toBeGreaterThan(preHideGuest + 30);

        // No error / freeze / infinite-correction loop: guest keeps advancing and
        // stays close to the host (no oscillation).
        for (let i = 0; i < 5; i++) {
            const s = await videoInfo(guest);
            expect(s.error).toBe(false);
            expect(s.paused).toBe(false);
            await guest.waitForTimeout(1000);
        }
        const gEnd = await videoTime(guest);
        const hEnd = await videoTime(host);
        expect(Math.abs(gEnd - hEnd)).toBeLessThanOrEqual(DRIFT_TOLERANCE + 1);

        await hostCtx.close();
        await guestCtx.close();
    });

    test("2.3 stale/out-of-order PATCH response does not override newer state; polling continues", async ({
        browser,
    }) => {
        test.setTimeout(60000);

        const hostCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const host = await hostCtx.newPage();
        const room = await createLocalRoom(host);
        await host.goto(room.room_url);
        await waitForVideo(host);
        expect(await ensurePlaying(host)).toBe(true);

        // Route interception: hold the FIRST PATCH so it can be released AFTER a
        // newer one has already been applied. The held first request is never sent
        // to the server (its response is synthesized later with a stale version);
        // subsequent PATCHes are forwarded normally (route.continue) to the real
        // server so the hook picks up a newer state_version.
        //
        // Note: `route.fetch()` (re-request from Node) hangs against `php artisan
        // serve` for PATCH, so we forward via continue() and only synthesize the one
        // held response.
        let heldReq: { route: Route; body: Record<string, unknown> } | null =
            null;
        let patchCount = 0;
        await host.route(/\/playback\/\d+$/, async (route) => {
            const req = route.request();
            if (req.method() !== "PATCH") {
                await route.continue();
                return;
            }
            patchCount++;
            if (patchCount === 1) {
                heldReq = {
                    route,
                    body: (req.postDataJSON() ?? {}) as Record<string, unknown>,
                };
                return; // hold; do not contact the server yet
            }
            await route.continue(); // forward to the real server
        });

        // Trigger a seek via the host UI (ArrowRight on the seek slider). A
        // seek's handleSeeked ALWAYS emits a PATCH (it does not consult the
        // applyingRef gesture guard, unlike handlePlay/handlePause), so this is
        // a reliable source of PATCH #1 to hold. We avoid using the play/pause
        // button here: when ensurePlaying already has the video playing, that
        // click pauses it, and its sync can be swallowed by the applyingRef
        // guard if a poll-driven apply lands in the same 100ms window — leaving
        // the video paused with no timeupdate, so no second PATCH ever fires.
        await host.getByRole("slider", { name: "جستجو" }).focus();
        await host.keyboard.press("ArrowRight");

        // Wait for the intercept to catch and hold the first PATCH BEFORE
        // issuing the second seek. If the two seeks overlap, the media element
        // coalesces them into a single `seeked` (one PATCH); spacing them by a
        // full second (>> local-file seek latency) guarantees each produces its
        // own seeked event and thus its own PATCH.
        await expect
            .poll(() => patchCount, { timeout: 15000 })
            .toBeGreaterThanOrEqual(1);
        expect(heldReq).not.toBeNull();

        // PATCH #1 is now held as an OLDER request. Issue a second, spaced seek
        // to produce PATCH #2 DETERMINISTICALLY — the seeked path always emits a
        // PATCH, unlike the throttled+debounced timeupdate sync (which only
        // fires while `timeupdate` events keep coming and can stall if the
        // media pauses while buffering). The second PATCH is forwarded to the
        // real server and bumps its state_version, so PATCH #1's later stale
        // response (state_version: 0) proves the version guard works.
        await host.waitForTimeout(1200);
        await host.getByRole("slider", { name: "جستجو" }).focus();
        await host.keyboard.press("ArrowRight");
        await expect
            .poll(() => patchCount, { timeout: 15000 })
            .toBeGreaterThanOrEqual(2);

        // Release the stale (first) PATCH with a guaranteed-old version. The hook
        // must ignore it because a newer version was already applied.
        await heldReq!.route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: "ok", state_version: 0 }),
        });

        // The stale response must not have regressed the hook's version: the next
        // normal poll still applies, so playback keeps advancing (no freeze).
        await expect
            .poll(async () => videoTime(host), { timeout: 15000 })
            .toBeGreaterThan(0);

        // A fresh seek still works and produces a new PATCH.
        await host.getByRole("slider", { name: "جستجو" }).focus();
        await host.keyboard.press("ArrowRight");
        await expect
            .poll(() => patchCount, { timeout: 15000 })
            .toBeGreaterThanOrEqual(3);

        expect((await videoInfo(host)).error).toBe(false);
        await host.unrouteAll({ behavior: "ignoreErrors" });

        await hostCtx.close();
    });

    test("2.4 late-joining guest does not cause host position regression or oscillation", async ({
        browser,
    }) => {
        test.setTimeout(90000);

        const hostCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const host = await hostCtx.newPage();
        const room = await createLocalRoom(host);
        await host.goto(room.room_url);
        await waitForVideo(host);
        expect(await ensurePlaying(host)).toBe(true);

        // Let the host play alone for 12 seconds — enough to reach ~12-14s so that
        // a late join produces a meaningful gap between host and server state.
        await host.waitForTimeout(12000);
        const hostBefore = await videoTime(host);
        expect(hostBefore).toBeGreaterThan(10);
        console.log(`2.4 host before guest: ${hostBefore.toFixed(2)}s`);

        // Join a guest while the host is well ahead.
        const guestCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const guest = await guestCtx.newPage();
        await joinAsGuest(guest, room.invite_code);
        await guest.goto(room.room_url);
        await waitForVideo(guest);
        await guest.waitForTimeout(1500);
        await startPlayback(guest);
        expect(await ensurePlaying(guest)).toBe(true);

        // The host video must NOT regress — it should keep advancing from where it
        // was when the guest joined (no backward seek, no oscillation).
        const hostAfterJoin = await videoTime(host);
        expect(hostAfterJoin).toBeGreaterThanOrEqual(hostBefore - 1);
        console.log(
            `2.4 host immediately after guest join: ${hostAfterJoin.toFixed(2)}s (was ${hostBefore.toFixed(2)}s)`,
        );

        // Wait for the guest to converge.  Both videos should stay monotonically
        // advancing and end up within tolerance.
        await expect
            .poll(
                async () => {
                    const h = await videoTime(host);
                    const g = await videoTime(guest);
                    return Math.abs(g - h);
                },
                { timeout: 30000 },
            )
            .toBeLessThanOrEqual(DRIFT_TOLERANCE);

        // No oscillation: host keeps advancing after convergence.
        for (let i = 0; i < 5; i++) {
            const h = await videoTime(host);
            const g = await videoTime(guest);
            expect(Math.abs(h - g)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
            await host.waitForTimeout(1000);
        }

        const hostEnd = await videoTime(host);
        const guestEnd = await videoTime(guest);
        console.log(
            `2.4 final: host=${hostEnd.toFixed(2)}s guest=${guestEnd.toFixed(2)}s diff=${Math.abs(hostEnd - guestEnd).toFixed(2)}s`,
        );
        expect(hostEnd).toBeGreaterThan(hostBefore + 5);
        expect((await videoInfo(host)).error).toBe(false);
        expect((await videoInfo(guest)).error).toBe(false);

        await hostCtx.close();
        await guestCtx.close();
    });
});
