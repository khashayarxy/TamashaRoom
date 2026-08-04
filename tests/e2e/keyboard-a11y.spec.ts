import { test, expect, type Page } from "@playwright/test";

async function openPopulatedRoom(page: Page): Promise<string> {
  const params = new URLSearchParams({
    with_video: "1",
    with_chat: "1",
    with_guest: "1",
  });
  const resp = await page.request.post(
    "/__test/setup-verified-room?" + params.toString(),
  );
  expect(resp.ok()).toBeTruthy();
  const data = await resp.json();
  const room_url = new URL(data.room_url).pathname;
  await page.goto(room_url);
  await page.waitForLoadState("networkidle");
  return room_url;
}

test.describe("Keyboard accessibility of room controls", () => {
  test("previously hover-only owner controls are reachable with the keyboard", async ({ page }) => {
    const room_url = await openPopulatedRoom(page);
    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    // The member list (with kick/transfer controls) is behind the "اعضا" tab.
    await page.getByRole("button", { name: "اعضا" }).click();
    await page.waitForLoadState("networkidle");

    // Focus the member list's owner actions (kick/transfer buttons) via Tab;
    // they must be real focusable buttons, not hover-only.
    await page.keyboard.press("Tab");
    let found = false;
    for (let i = 0; i < 40; i++) {
      const label = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return "";
        const text = el.getAttribute("aria-label") || el.textContent || "";
        return text.trim();
      });
      if (/انتقال مالکیت|از اتاق|transfer|kick/.test(label)) {
        found = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    expect(found).toBe(true);
  });
});
