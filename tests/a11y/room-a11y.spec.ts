import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Room page accessibility", () => {
  test("Populated room page has no critical or serious a11y violations", async ({ page }) => {
    const resp = await page.request().post("/__test/setup-verified-room", {
      data: {
        with_video: "1",
        with_chat: "1",
        with_subtitle: "1",
        with_guest: "1",
      },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });
});
