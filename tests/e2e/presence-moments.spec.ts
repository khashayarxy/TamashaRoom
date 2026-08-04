import { test, expect, type Page } from "@playwright/test";

async function getXsrfToken(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

interface PresenceMemberData {
  user_id: number;
  name: string;
  presence_status: string;
}

/**
 * The owner's own reconnect can emit a spurious "به اتاق پیوست" moment for
 * themselves (their presence flips offline -> online right after the page
 * loads). Waiting for the guest's *named* join moment is what actually proves
 * the host's presence baseline captured the guest as online — the leave moment
 * is only derivable once that baseline transition is in place.
 */
async function waitForGuestOnline(
  hostPage: Page,
  roomId: number,
  guestUserId: number,
): Promise<string> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const resp = await hostPage.request.get(`/presence/${roomId}`);
    const members = (await resp.json()) as PresenceMemberData[];
    const guest = members.find((m) => m.user_id === guestUserId);
    if (guest && guest.presence_status === "online") {
      return guest.name;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`guest ${guestUserId} never became online`);
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
    const { user_id: guestUserId } = await joinResp.json();
    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    // The owner's own reconnect can render a spurious join moment, so don't
    // gate on `.first()` of "به اتاق پیوست". Wait for the *guest's* named join
    // moment — that guarantees the host's baseline captured the guest online,
    // which is the transition the subsequent leave moment depends on.
    const guestName = await waitForGuestOnline(hostPage, room_id, guestUserId);
    await expect(
      hostPage.getByText(`${guestName} به اتاق پیوست`),
    ).toBeVisible({ timeout: 30000 });

    // Guest leaves; the leave endpoint flips them offline so the host's next
    // presence poll detects the transition deterministically.
    const guestXsrf = await getXsrfToken(guestPage);
    const leaveResp = await guestPage.request.post(`/presence/${room_id}/leave`, {
      data: { _token: guestXsrf },
    });
    expect(leaveResp.ok()).toBeTruthy();

    await expect(
      hostPage.getByText(`${guestName} از اتاق خارج شد`),
    ).toBeVisible({ timeout: 30000 });

    await hostCtx.close();
    await guestCtx.close();
  });
});
