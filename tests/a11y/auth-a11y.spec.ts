import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility audit — auth pages", () => {
    test("Forgot password page has no critical or serious a11y violations", async ({
        page,
    }) => {
        await page.goto("/forgot-password");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "best-practice",
            ])
            .analyze();

        const serious = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(serious).toEqual([]);
    });

    test("Verify email page has no critical or serious a11y violations", async ({
        page,
    }) => {
        const email = `a11y-test-${Date.now()}@example.com`;

        await page.goto("/register");
        await page.waitForLoadState("networkidle");

        // Registration runs against the Playwright web server (MAIL_MAILER=array),
        // so the verification notification is captured in memory — no real Resend call,
        // no inbox involved.
        await page.fill("#name", "Test User");
        await page.fill("#email", email);
        await page.fill("#password", "Password123!");
        await page.fill("#password_confirmation", "Password123!");
        await page.click('button[type="submit"]');

        // An unverified user is redirected to the verification prompt page.
        await page.waitForURL(/verify-email/, { timeout: 10000 });
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "best-practice",
            ])
            .analyze();

        const serious = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(serious).toEqual([]);

        // Complete verification using the real signed URL — the exact same URL the
        // array-captured notification would have contained (rendered by the test-only
        // __test/verification-url helper), instead of expecting an email to arrive.
        const { url } = await page.request
            .get(`/__test/verification-url?email=${encodeURIComponent(email)}`)
            .then((r) => r.json());
        await page.goto(url);

        // Verification must unlock the dashboard route (guarded by the verified
        // middleware). Landing there after clicking the signed URL proves the
        // verification succeeded. The redirect may resolve from the session
        // `intended` URL (/dashboard) — the `?verified=1` fallback applies only
        // when no intended URL is stored — so assert on /dashboard, not the query.
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
        expect(page.url()).toContain("/dashboard");
    });

    test("Profile page has no critical or serious a11y violations", async ({
        page,
    }) => {
        await page.goto("/__test/setup-verified-room");
        await page.waitForLoadState("networkidle");

        await page.goto("/profile");
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/profile");

        const results = await new AxeBuilder({ page })
            .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "best-practice",
            ])
            .analyze();

        const serious = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(serious).toEqual([]);
    });

    test("Reset password page has no critical or serious a11y violations", async ({
        page,
    }) => {
        await page.goto("/reset-password/test-token?email=test@example.com");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "best-practice",
            ])
            .analyze();

        const serious = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(serious).toEqual([]);
    });

    test("Confirm password page has no critical or serious a11y violations", async ({
        page,
    }) => {
        await page.goto("/__test/setup-verified-room");
        await page.waitForLoadState("networkidle");

        await page.goto("/confirm-password");
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/confirm-password");

        const results = await new AxeBuilder({ page })
            .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "best-practice",
            ])
            .analyze();

        const serious = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(serious).toEqual([]);
    });

    test("Profile delete-account modal (open) has no critical or serious a11y violations", async ({
        page,
    }) => {
        await page.goto("/__test/setup-verified-room");
        await page.waitForLoadState("networkidle");

        await page.goto("/profile");
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/profile");

        await page.getByRole("button", { name: "حذف حساب کاربری" }).click();
        await page.getByRole("dialog").waitFor();

        const results = await new AxeBuilder({ page })
            .withTags([
                "wcag2a",
                "wcag2aa",
                "wcag21a",
                "wcag21aa",
                "best-practice",
            ])
            .analyze();

        const serious = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(serious).toEqual([]);
    });
});
