import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Welcome page accessibility", () => {
  test("Mobile registration stays separate from the theme control", async ({ page }) => {
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const nav = page.getByRole("navigation", { name: "ناوبری اصلی" });
      const registration = nav.getByRole("link", { name: "ثبت‌نام", exact: true });
      const theme = nav.getByRole("button", { name: /حالت روشن|حالت تاریک/ });
      const linkBox = await registration.boundingBox();
      const themeBox = await theme.boundingBox();
      expect(linkBox).not.toBeNull();
      expect(themeBox).not.toBeNull();
      if (linkBox && themeBox) {
        const overlap = Math.min(linkBox.x + linkBox.width, themeBox.x + themeBox.width) > Math.max(linkBox.x, themeBox.x)
          && Math.min(linkBox.y + linkBox.height, themeBox.y + themeBox.height) > Math.max(linkBox.y, themeBox.y);
        expect(overlap).toBe(false);
      }
      await expect(registration).toHaveAttribute("href", /\/register$/);
      await expect(page.locator('a[href="#"]')).toHaveCount(0);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test("Landing page has no critical or serious a11y violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });
});
