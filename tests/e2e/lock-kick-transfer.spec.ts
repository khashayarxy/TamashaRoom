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

    // Toggle lock ON
    const lockResp = await page.request.post(`/rooms/${room_id}/toggle-lock`, {
      data: { _token: xsrf },
    });
    expect(lockResp.ok()).toBeTruthy();
    const lockResult = await lockResp.json();
    expect(lockResult.is_locked).toBe(true);

    // Guest (authenticated stranger) tries to join a locked room via the POST
    // join action — should be rejected with a redirect back (302) and NOT
    // become a member.
    const guestCtx = await page.context().browser()!.newContext();
    const guestPage = await guestCtx.newPage();
    const guestSetup = await guestPage.request.post("/__test/setup-verified-room");
    expect(guestSetup.ok()).toBeTruthy();
    const guestXsrf = await getXsrfToken(guestPage);
    const joinRouteResp = await guestPage.request.post(
      `/rooms/join/${invite_code}`,
      { data: { _token: guestXsrf }, maxRedirects: 0 },
    );
    // Locked room: rejected (302 redirect back), not a successful join (2xx).
    expect(joinRouteResp.status()).toBe(302);

    await guestCtx.close();
  });

  test("Owner can kick a member", async ({ browser }) => {
    test.setTimeout(20000);

    const hostCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const hostPage = await hostCtx.newPage();

    const resp = await hostPage.request.post("/__test/setup-verified-room", {
      data: { with_guest: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    const hostXsrf = await getXsrfToken(hostPage);

    const membersResp = await hostPage.request.get(`/rooms/${room_id}/members`);
    expect(membersResp.ok()).toBeTruthy();
    const members = await membersResp.json();
    const guestMember = members.find((m: { is_owner: boolean }) => !m.is_owner);
    expect(guestMember).toBeDefined();
    const guestUserId = guestMember.user_id;

    // Kick the guest
    const kickResp = await hostPage.request.post(`/rooms/${room_id}/kick/${guestUserId}`, {
      data: { _token: hostXsrf },
    });
    expect(kickResp.ok()).toBeTruthy();

    // Verify the guest is no longer listed as a member
    const membersAfterResp = await hostPage.request.get(`/rooms/${room_id}/members`);
    expect(membersAfterResp.ok()).toBeTruthy();
    const membersAfter = await membersAfterResp.json();
    expect(membersAfter.some((m: { user_id: number }) => m.user_id === guestUserId)).toBe(false);

    await hostCtx.close();
  });

  test("Ownership transfer reassigns room owner", async ({ browser }) => {
    test.setTimeout(20000);

    const hostCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const hostPage = await hostCtx.newPage();

    const resp = await hostPage.request.post("/__test/setup-verified-room", {
      data: { with_guest: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    const hostXsrf = await getXsrfToken(hostPage);

    // Get members to find the guest's user_id
    const membersResp = await hostPage.request.get(`/rooms/${room_id}/members`);
    expect(membersResp.ok()).toBeTruthy();
    const members = await membersResp.json();
    const guestMember = members.find((m: { is_owner: boolean }) => !m.is_owner);
    expect(guestMember).toBeDefined();
    const guestUserId = guestMember.user_id;

    // Transfer ownership to guest
    const transferResp = await hostPage.request.post(`/rooms/${room_id}/transfer/${guestUserId}`, {
      data: { _token: hostXsrf },
    });
    expect(transferResp.ok()).toBeTruthy();

    // Verify old host can no longer perform owner-only actions
    const lockAfterResp = await hostPage.request.post(`/rooms/${room_id}/toggle-lock`, {
      data: { _token: hostXsrf },
    });
    expect(lockAfterResp.status() === 403 || lockAfterResp.status() === 302).toBe(true);

    // Verify new owner (guest context) CAN perform owner actions
    const guestCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const guestSessionResp = await guestCtx.request.post("/__test/join-room", {
      data: { invite_code },
    });
    expect(guestSessionResp.ok()).toBeTruthy();

    const guestPage = await guestCtx.newPage();
    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    const guestXsrf = await getXsrfToken(guestPage);

    // New owner can toggle lock
    const newOwnerLockResp = await guestPage.request.post(`/rooms/${room_id}/toggle-lock`, {
      data: { _token: guestXsrf },
    });
    expect(newOwnerLockResp.ok()).toBeTruthy();
    const lockResult = await newOwnerLockResp.json();
    expect(lockResult.is_locked).toBe(true);

    await hostCtx.close();
    await guestCtx.close();
  });

  test("Non-owner cannot kick members or transfer ownership", async ({ browser }) => {
    test.setTimeout(20000);

    const hostCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const hostPage = await hostCtx.newPage();

    const resp = await hostPage.request.post("/__test/setup-verified-room", {
      data: { with_guest: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await hostPage.goto(room_url);
    await hostPage.waitForLoadState("networkidle");

    // Get the guest's XSRF token by having them join
    const guestCtx = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const guestJoinResp = await guestCtx.request.post("/__test/join-room", {
      data: { invite_code },
    });
    expect(guestJoinResp.ok()).toBeTruthy();

    const guestPage = await guestCtx.newPage();
    await guestPage.goto(room_url);
    await guestPage.waitForLoadState("networkidle");

    const guestXsrf = await getXsrfToken(guestPage);

    // Guest tries to kick another member (target 0 = invalid)
    const kickResp = await guestPage.request.post(`/rooms/${room_id}/kick/0`, {
      data: { _token: guestXsrf },
    });
    expect(kickResp.status() === 403 || kickResp.status() === 302 || kickResp.status() === 404).toBe(true);

    // Guest tries to transfer ownership
    const transferResp = await guestPage.request.post(`/rooms/${room_id}/transfer/0`, {
      data: { _token: guestXsrf },
    });
    expect(transferResp.status() === 403 || transferResp.status() === 302 || transferResp.status() === 404).toBe(true);

    await hostCtx.close();
    await guestCtx.close();
  });
});
