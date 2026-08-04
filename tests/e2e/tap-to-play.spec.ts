import { test, expect, type Page } from "@playwright/test";

/**
 * Simulates the browser's autoplay-block for the guest page.
 *
 * The real block (an unmuted <video> whose play() is called with no prior user
 * gesture) cannot be triggered in this test environment: Chromium exempts
 * loopback origins from the autoplay policy, and neither Playwright's Chromium
 * build nor system Chrome enforce it here even with
 * `--autoplay-policy=user-gesture-required` (verified across flag variants,
 * preference overrides, and CDP). This injects the exact rejection the browser
 * produces in production (`NotAllowedError`), cleared after the first trusted
 * click — mirroring Chrome's sticky user-activation behaviour. The app code
 * path is real: the sync effect's `video.play().catch()` sets the blocked
 * state, the overlay renders, the click runs `handleLocalPlay`, and the video
 * genuinely plays (real same-origin media in `public/videos/sample.mp4`).
 */
const AUTOPLAY_BLOCK_INIT = `
  window.__autoplayBlocked = true;
  document.addEventListener("click", () => {
    window.__autoplayBlocked = false;
  }, { capture: true, once: true });
  const __origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (window.__autoplayBlocked) {
      return Promise.reject(new DOMException("blocked by autoplay policy", "NotAllowedError"));
    }
    return __origPlay.apply(this, arguments);
  };
`;

async function createRoomWithVideo(page: Page): Promise<{
  room_url: string;
  invite_code: string;
}> {
  const resp = await page.request.post("/__test/setup-verified-room?local_video=1");
  expect(resp.ok()).toBeTruthy();
  return await resp.json();
}

async function joinAsGuest(page: Page, inviteCode: string): Promise<void> {
  const resp = await page.request.post("/__test/join-room?force_new=1", {
    data: { invite_code: inviteCode },
  });
  expect(resp.ok()).toBeTruthy();
}

test.describe("Guest tap-to-play", () => {
  test("autoplay blocked -> overlay shown -> click starts local playback without mutating server state", async ({
    browser,
  }) => {
    test.setTimeout(60000);

    const hostCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const host = await hostCtx.newPage();
    const { room_url, invite_code } = await createRoomWithVideo(host);

    const guestCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    await guestCtx.addInitScript({ content: AUTOPLAY_BLOCK_INIT });
    const guest = await guestCtx.newPage();

    const playbackMutations: string[] = [];
    guest.on("request", (req) => {
      if (
        /\/playback\/\d+$/.test(req.url()) &&
        ["PATCH", "POST", "DELETE"].includes(req.method())
      ) {
        playbackMutations.push(`${req.method()} ${req.url()}`);
      }
    });

    await joinAsGuest(guest, invite_code);
    await guest.goto(room_url, { waitUntil: "domcontentloaded" });

    // The guest's unmuted video cannot autoplay without a gesture: the overlay
    // is shown and the video stays paused.
    const overlay = guest.getByRole("button", { name: "شروع پخش" });
    await expect(overlay).toBeVisible({ timeout: 20000 });
    expect(
      await guest.evaluate(() => document.querySelector("video")?.paused),
    ).toBe(true);

    // Clicking the overlay grants the gesture and starts local playback.
    await overlay.click();
    await expect(overlay).toBeHidden({ timeout: 5000 });

    await expect
      .poll(
        () =>
          guest.evaluate(() => {
            const video = document.querySelector("video");
            return video ? { paused: video.paused, t: video.currentTime } : null;
          }),
        { timeout: 15000 },
      )
      .toEqual(expect.objectContaining({ paused: false }));

    // Playback position actually advances (real media, not a stub).
    const t1 = await guest.evaluate(
      () => document.querySelector("video")?.currentTime ?? 0,
    );
    await guest.waitForTimeout(1500);
    const t2 = await guest.evaluate(
      () => document.querySelector("video")?.currentTime ?? 0,
    );
    expect(t2).toBeGreaterThan(t1);

    // The guest's local play is purely local: no playback mutation request
    // (PATCH/POST/DELETE to /playback/{room}) is ever sent.
    expect(playbackMutations).toEqual([]);

    await hostCtx.close();
    await guestCtx.close();
  });

  test("overlay reappears for a fresh guest session (autoplay blocked again)", async ({
    browser,
  }) => {
    test.setTimeout(60000);

    const hostCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const host = await hostCtx.newPage();
    const { room_url, invite_code } = await createRoomWithVideo(host);

    const guestCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    await guestCtx.addInitScript({ content: AUTOPLAY_BLOCK_INIT });
    const guest = await guestCtx.newPage();
    await joinAsGuest(guest, invite_code);

    // A fresh session/context has no prior gesture, so the browser would block
    // autoplay again and the overlay must reappear.
    await guest.goto(room_url, { waitUntil: "domcontentloaded" });
    await expect(guest.getByRole("button", { name: "شروع پخش" })).toBeVisible({
      timeout: 20000,
    });
    expect(
      await guest.evaluate(() => document.querySelector("video")?.paused),
    ).toBe(true);

    await hostCtx.close();
    await guestCtx.close();
  });
});
