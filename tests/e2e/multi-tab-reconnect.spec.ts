import { test, expect } from "@playwright/test";

test.describe("Multi-tab session persistence and room reconnection", () => {
  test("Opening a second tab does not log out the first tab's active room session", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const tab1 = await context.newPage();

    // Setup room & authenticate user in Tab 1
    const setupResp = await tab1.request.post("/__test/setup-verified-room");
    expect(setupResp.ok()).toBeTruthy();
    const { room_url } = await setupResp.json();

    await tab1.goto(room_url);
    await tab1.getByRole("button", { name: "چت" }).waitFor();

    // Open Tab 2 in the same browser context (same session cookie)
    const tab2 = await context.newPage();
    await tab2.goto("/dashboard");
    await tab2.waitForLoadState("networkidle");

    // Perform an action in Tab 2 (e.g. visit profile or room list)
    await expect(tab2.getByText("اتاق‌های من")).toBeVisible();

    // Verify Tab 1 remains logged in and active in the room
    await expect(tab1.getByRole("button", { name: "چت" })).toBeVisible();
    expect(new URL(tab1.url()).pathname).toBe(new URL(room_url).pathname);

    await context.close();
  });

  test("Closing and reopening a tab reconnects to the same room without re-invitation", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: "http://127.0.0.1:8000" });
    const tab1 = await context.newPage();

    // Setup room & authenticate user
    const setupResp = await tab1.request.post("/__test/setup-verified-room");
    expect(setupResp.ok()).toBeTruthy();
    const { room_url } = await setupResp.json();

    await tab1.goto(room_url);
    await tab1.getByRole("button", { name: "چت" }).waitFor();

    // Simulate tab close by closing tab1
    await tab1.close();

    // Reopen tab2 in the same context to the room URL directly
    const tab2 = await context.newPage();
    await tab2.goto(room_url);

    // User is reconnected to the room cleanly without needing the invite link again
    await expect(tab2.getByRole("button", { name: "چت" })).toBeVisible();
    expect(new URL(tab2.url()).pathname).toBe(new URL(room_url).pathname);

    await context.close();
  });
});
