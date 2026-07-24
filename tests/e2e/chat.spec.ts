import { test, expect, type Page } from "@playwright/test";

async function getXsrfToken(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

test.describe("Chat flow", () => {
  test("Host sends a message and guest sees it via polling", async ({ browser }) => {
    test.setTimeout(30000);

    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();

    const resp = await hostPage.request().post("/__test/setup-verified-room", {
      data: { with_chat: "1" },
    });
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

    // Extract CSRF token and send a message as host
    const hostXsrf = await getXsrfToken(hostPage);
    const hostHeaders = hostXsrf ? { "X-XSRF-TOKEN": hostXsrf } : {};

    const sendResp = await hostPage.request().post(`/chat/${room_id}/messages`, {
      data: { body: "Hello from host!" },
      headers: hostHeaders,
    });
    expect(sendResp.ok()).toBeTruthy();

    // Guest polls until the message appears (max ~12s)
    let found = false;
    for (let i = 0; i < 4; i++) {
      await guestPage.waitForTimeout(3000);
      const msgsResp = await guestPage.request().get(`/chat/${room_id}/messages`);
      expect(msgsResp.ok()).toBeTruthy();
      const messages = await msgsResp.json();
      if (messages.some((m: { body: string }) => m.body === "Hello from host!")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);

    await hostCtx.close();
    await guestCtx.close();
  });

  test("Host sends Persian message and deletes it", async ({ page }) => {
    test.setTimeout(20000);

    const resp = await page.request().post("/__test/setup-verified-room", {
      data: { with_chat: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    const xsrf = await getXsrfToken(page);
    const headers = xsrf ? { "X-XSRF-TOKEN": xsrf } : {};

    // Send a Persian message
    const sendResp = await page.request().post(`/chat/${room_id}/messages`, {
      data: { body: "سلام! این یک پیام تست است" },
      headers,
    });
    expect(sendResp.ok()).toBeTruthy();
    const sentMsg = await sendResp.json();
    expect(sentMsg.body).toBe("سلام! این یک پیام تست است");

    // Verify it appears in the message list
    const msgsResp = await page.request().get(`/chat/${room_id}/messages`);
    expect(msgsResp.ok()).toBeTruthy();
    const messages = await msgsResp.json();
    expect(messages.some((m: { id: number }) => m.id === sentMsg.id)).toBe(true);

    // Delete the message
    const delResp = await page.request().delete(`/chat/${room_id}/messages/${sentMsg.id}`, {
      headers,
    });
    expect(delResp.ok()).toBeTruthy();
    expect((await delResp.json()).status).toBe("ok");

    // Verify it's gone from the list
    const msgsAfterResp = await page.request().get(`/chat/${room_id}/messages`);
    expect(msgsAfterResp.ok()).toBeTruthy();
    const messagesAfter = await msgsAfterResp.json();
    expect(messagesAfter.some((m: { id: number }) => m.id === sentMsg.id)).toBe(false);
  });
});
