import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoRoom } from "./room-nav";

test.describe("Room page accessibility", () => {
  test("Populated room page has no critical or serious a11y violations", async ({ page }) => {
    const params = new URLSearchParams({
      with_video: "1",
      with_chat: "1",
      with_subtitle: "1",
      with_guest: "1",
    });

    await gotoRoom(page, params);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });
});
