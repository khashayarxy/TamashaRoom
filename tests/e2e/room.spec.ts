import { test, expect, type Page } from "@playwright/test";

async function getXsrfToken(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

test.describe("Room creation and joining", () => {
  test("Host can create a room and see the room page", async ({ page }) => {
    const resp = await page.request().post("/__test/setup-verified-room");
    expect(resp.ok()).toBeTruthy();
    const { room_url } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1, h2")).toBeVisible();
  });

  test("Guest joins room via invite code", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const resp = await hostPage.request().post("/__test/setup-verified-room");
    expect(resp.ok()).toBeTruthy();
    const { room_url, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    const guestCtx = await browser.newContext();
    const guestPage = await guestCtx.newPage();
    const joinResp = await guestPage.request().post("/__test/join-room", {
      data: { invite_code },
    });
    expect(joinResp.ok()).toBeTruthy();

    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    await expect(guestPage.locator("h1, h2")).toBeVisible();
    await hostCtx.close();
    await guestCtx.close();
  });

  test("Playback state propagates from host to guest", async ({ browser }) => {
    test.setTimeout(30000);

    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const resp = await hostPage.request().post("/__test/setup-verified-room");
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    const guestCtx = await browser.newContext();
    const guestPage = await guestCtx.newPage();
    const joinResp = await guestPage.request().post("/__test/join-room", {
      data: { invite_code },
    });
    expect(joinResp.ok()).toBeTruthy();

    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    // Establish the video URL via the host's session
    const xsrfToken = await getXsrfToken(hostPage);
    const commonHeaders = xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {};

    const videoUrl = "https://www.example.com/video.mp4";
    const setVideoResp = await hostPage.request().post(`/playback/${room_id}/set-video`, {
      data: { video_url: videoUrl, duration_seconds: 120 },
      headers: commonHeaders,
    });
    expect(setVideoResp.ok()).toBeTruthy();

    // Host changes playback state
    const patchResp = await hostPage.request().patch(`/playback/${room_id}`, {
      data: {
        is_playing: true,
        position_seconds: 10,
        duration_seconds: 120,
        playback_rate: 1,
        client_timestamp: Date.now() / 1000,
      },
      headers: commonHeaders,
    });
    expect(patchResp.ok()).toBeTruthy();

    // Poll until guest sees the updated state (max ~15s)
    let guestState: Record<string, unknown> = {};
    for (let i = 0; i < 6; i++) {
      await guestPage.waitForTimeout(2500);
      const stateResp = await guestPage.request().get(`/playback/${room_id}/state`, { timeout: 5000 });
      expect(stateResp.ok()).toBeTruthy();
      guestState = await stateResp.json();
      if (guestState.is_playing === true) break;
    }
    expect(guestState.is_playing).toBe(true);
    expect(guestState.video_url).toBe(videoUrl);

    await hostCtx.close();
    await guestCtx.close();
  });
});
