import { test, expect, type Page } from "@playwright/test";

async function getXsrfToken(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

test.describe("Room lock, kick, and ownership transfer", () => {
  test("Owner can lock room, preventing new joins", async ({ page }) => {
    test.setTimeout(20000);

    const resp = await page.request.post("/__test/setup-verified-room");
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    const xsrf = await getXsrfToken(page);
    const headers = xsrf ? { "X-XSRF-TOKEN": xsrf } : {};

    // Toggle lock ON
    const lockResp = await page.request.post(`/rooms/${room_id}/toggle-lock`, { headers });
    expect(lockResp.ok()).toBeTruthy();
    const lockResult = await lockResp.json();
    expect(lockResult.is_locked).toBe(true);

    // Guest tries to join via the join route — should be rejected (room locked)
    const guestCtx = await page.context().browser()!.newContext();
    const guestPage = await guestCtx.newPage();
    const joinRouteResp = await guestPage.request.get(`/rooms/join/${invite_code}`, {
      maxRedirects: 0,
    });
    expect(joinRouteResp.status() === 302 || joinRouteResp.status() === 403).toBe(true);

    await guestCtx.close();
  });

  test("Owner can kick a member", async ({ browser }) => {
    test.setTimeout(20000);

    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();

    const resp = await hostPage.request.post("/__test/setup-verified-room", {
      data: { with_guest: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    const hostXsrf = await getXsrfToken(hostPage);
    const hostHeaders = hostXsrf ? { "X-XSRF-TOKEN": hostXsrf } : {};

    const membersResp = await hostPage.request.get(`/rooms/${room_id}/members`, {
      headers: hostHeaders,
    });
    expect(membersResp.ok()).toBeTruthy();
    const members = await membersResp.json();
    const guestMember = members.find((m: { is_owner: boolean }) => !m.is_owner);
    expect(guestMember).toBeDefined();
    const guestUserId = guestMember.user_id;

    // Kick the guest
    const kickResp = await hostPage.request.post(`/rooms/${room_id}/kick/${guestUserId}`, {
      headers: hostHeaders,
    });
    expect(kickResp.ok()).toBeTruthy();

    // Verify the guest is no longer listed as a member
    const membersAfterResp = await hostPage.request.get(`/rooms/${room_id}/members`, {
      headers: hostHeaders,
    });
    expect(membersAfterResp.ok()).toBeTruthy();
    const membersAfter = await membersAfterResp.json();
    expect(membersAfter.some((m: { user_id: number }) => m.user_id === guestUserId)).toBe(false);

    await hostCtx.close();
  });

  test("Ownership transfer reassigns room owner", async ({ browser }) => {
    test.setTimeout(20000);

    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();

    const resp = await hostPage.request.post("/__test/setup-verified-room", {
      data: { with_guest: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    const hostXsrf = await getXsrfToken(hostPage);
    const hostHeaders = hostXsrf ? { "X-XSRF-TOKEN": hostXsrf } : {};

    // Get members to find the guest's user_id
    const membersResp = await hostPage.request.get(`/rooms/${room_id}/members`, {
      headers: hostHeaders,
    });
    expect(membersResp.ok()).toBeTruthy();
    const members = await membersResp.json();
    const guestMember = members.find((m: { is_owner: boolean }) => !m.is_owner);
    expect(guestMember).toBeDefined();
    const guestUserId = guestMember.user_id;

    // Transfer ownership to guest
    const transferResp = await hostPage.request.post(`/rooms/${room_id}/transfer/${guestUserId}`, {
      headers: hostHeaders,
    });
    expect(transferResp.ok()).toBeTruthy();

    // Verify old host can no longer perform owner-only actions
    const lockAfterResp = await hostPage.request.post(`/rooms/${room_id}/toggle-lock`, {
      headers: hostHeaders,
    });
    expect(lockAfterResp.status() === 403 || lockAfterResp.status() === 302).toBe(true);

    // Verify new owner (guest context) CAN perform owner actions
    const guestCtx = await browser.newContext();
    const guestSessionResp = await guestCtx.request.post("/__test/join-room", {
      data: { invite_code },
    });
    expect(guestSessionResp.ok()).toBeTruthy();

    const guestPage = await guestCtx.newPage();
    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    const guestXsrf = await getXsrfToken(guestPage);
    const guestHeaders = guestXsrf ? { "X-XSRF-TOKEN": guestXsrf } : {};

    // New owner can toggle lock
    const newOwnerLockResp = await guestPage.request.post(`/rooms/${room_id}/toggle-lock`, {
      headers: guestHeaders,
    });
    expect(newOwnerLockResp.ok()).toBeTruthy();
    const lockResult = await newOwnerLockResp.json();
    expect(lockResult.is_locked).toBe(true);

    await hostCtx.close();
    await guestCtx.close();
  });

  test("Non-owner cannot kick members or transfer ownership", async ({ browser }) => {
    test.setTimeout(20000);

    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();

    const resp = await hostPage.request.post("/__test/setup-verified-room", {
      data: { with_guest: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    // Get the guest's XSRF token by having them join
    const guestCtx = await browser.newContext();
    const guestJoinResp = await guestCtx.request.post("/__test/join-room", {
      data: { invite_code },
    });
    expect(guestJoinResp.ok()).toBeTruthy();

    const guestPage = await guestCtx.newPage();
    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    const guestXsrf = await getXsrfToken(guestPage);
    const guestHeaders = guestXsrf ? { "X-XSRF-TOKEN": guestXsrf } : {};

    // Guest tries to kick another member (target 0 = invalid)
    const kickResp = await guestPage.request.post(`/rooms/${room_id}/kick/0`, {
      headers: guestHeaders,
    });
    expect(kickResp.status() === 403 || kickResp.status() === 302).toBe(true);

    // Guest tries to transfer ownership
    const transferResp = await guestPage.request.post(`/rooms/${room_id}/transfer/0`, {
      headers: guestHeaders,
    });
    expect(transferResp.status() === 403 || transferResp.status() === 302).toBe(true);

    await hostCtx.close();
    await guestCtx.close();
  });
});
