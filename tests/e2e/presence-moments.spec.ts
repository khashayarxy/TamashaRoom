import { test, expect, type Page } from "@playwright/test";

async function getXsrfToken(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

test.describe("Presence join/leave moments", () => {
  test("Host chat shows a system message when a guest joins and leaves", async ({ browser }) => {
    test.setTimeout(60000);

    const hostCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const hostPage = await hostCtx.newPage();
    const resp = await hostPage.request.post("/__test/setup-verified-room", {
      data: { with_video: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    // The setup helper creates the owner's membership with the default
    // presence_status (offline). Heartbeat once so the owner is online, then
    // reload so the host's presence baseline captures the owner as online.
    // Otherwise the owner's own reconnect would emit a spurious join moment.
    const hostXsrf = await getXsrfToken(hostPage);
    const ownerHb = await hostPage.request.post(`/presence/${room_id}/heartbeat`, {
      data: { _token: hostXsrf },
    });
    expect(ownerHb.ok()).toBeTruthy();

    await hostPage.reload();
    await hostPage.waitForLoadState("networkidle");

    // Guest joins the same room (distinct member) and opens the room page,
    // which triggers a heartbeat and turns the guest online.
    const guestCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const guestPage = await guestCtx.newPage();
    const joinResp = await guestPage.request.post("/__test/join-room", {
      data: { invite_code, force_new: true },
    });
    expect(joinResp.ok()).toBeTruthy();
    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    // Host polls presence every 5s; the join moment appears once the guest is
    // online. Poll for it up to ~30s.
    await expect(
      hostPage.getByText("به اتاق پیوست", { exact: false }).first(),
    ).toBeVisible({ timeout: 30000 });

    // Guest leaves; the leave endpoint flips them offline so the host's next
    // presence poll detects the transition deterministically.
    const guestXsrf = await getXsrfToken(guestPage);
    const leaveResp = await guestPage.request.post(`/presence/${room_id}/leave`, {
      data: { _token: guestXsrf },
    });
    expect(leaveResp.ok()).toBeTruthy();

    await expect(
      hostPage.getByText("از اتاق خارج شد", { exact: false }).first(),
    ).toBeVisible({ timeout: 30000 });

    await hostCtx.close();
    await guestCtx.close();
  });
});
