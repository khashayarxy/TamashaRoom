import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility audit", () => {
  test("Login page has no critical or serious a11y violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });

  test("Register page has no critical or serious a11y violations", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });

  test("Dashboard page has no critical or serious a11y violations", async ({ page }) => {
    await page.goto("/__test/setup-verified-room");
    await page.waitForLoadState("networkidle");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });
});
