import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility audit — auth pages", () => {
  test("Forgot password page has no critical or serious a11y violations", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });

  test("Verify email page has no critical or serious a11y violations", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="name"]', "Test User");
    await page.fill('input[name="email"]', `a11y-test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', "Password123!");
    await page.fill('input[name="password_confirmation"]', "Password123!");
    await page.click('button[type="submit"]');

    await page.waitForURL(/verify-email|dashboard/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/dashboard")) {
      await page.goto("/verify-email");
      await page.waitForLoadState("networkidle");
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });

  test("Profile page has no critical or serious a11y violations", async ({ page }) => {
    const resp = await page.request.post("/__test/setup-verified-room");
    expect(resp.ok()).toBeTruthy();

    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/profile");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious).toEqual([]);
  });
});
