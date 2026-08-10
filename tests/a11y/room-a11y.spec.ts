import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Room page accessibility", () => {
  test("Populated room page has no critical or serious a11y violations", async ({ page }) => {
    const params = new URLSearchParams({
      with_video: "1",
      with_chat: "1",
      with_subtitle: "1",
      with_guest: "1",
    });
    await page.goto("/__test/setup-verified-room?" + params.toString());
    await page.waitForLoadState("networkidle");

    const text = await page.evaluate(() => document.body.innerText);
    const data = JSON.parse(text);
    const room_url = new URL(data.room_url).pathname;

    await page.goto(room_url);
    // A room page with a video + live polling never reaches `networkidle`
    // (media fetches, playback-sync polls, presence heartbeats). The tab bar is
    // part of first paint, so waiting on it is the deterministic barrier.
    await page.getByRole("button", { name: "چت" }).waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });
});
