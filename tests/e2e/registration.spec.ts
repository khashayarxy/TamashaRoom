import { test, expect } from "@playwright/test";

// Zero-API email verification, end to end: register through the real UI,
// then verify through the REAL signed verification URL (surfaced by the
// env-gated /__test/verification-url helper) instead of an inbox. No mail
// provider is ever contacted: CI's webServer forces MAIL_MAILER=array (the
// notification is captured in memory), and nothing here reads a message.
//
// Skipped on local Windows (KI-016): `php artisan serve` drops the
// webServer.env MAIL_MAILER override there, and the Herd base URL runs the
// real resend mailer — either way POST /register would hit a live API and
// 500 on the @example.com address. To run locally, temporarily set
// MAIL_MAILER=array in .env (restore it afterwards).
test.skip(
    process.platform === "win32" && !process.env.CI,
    "KI-016: local Windows drops the MAIL_MAILER=array webServer override; temporarily set MAIL_MAILER=array in .env to run this spec locally",
);

test.describe("Registration + zero-API email verification", () => {
    test("register via UI, verify via the signed URL, land on the dashboard", async ({
        page,
    }) => {
        const email = `e2e-register-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}@example.com`;

        await page.goto("/register");
        await page.getByLabel("نام").fill("کاوه آزمون");
        await page.getByLabel("ایمیل").fill(email);
        await page.getByLabel("رمز عبور", { exact: true }).fill("password");
        await page.getByLabel("تکرار رمز عبور").fill("password");

        await Promise.all([
            page.waitForURL(/\/verify-email|\/dashboard/),
            page.getByRole("button", { name: "ثبت‌نام" }).click(),
        ]);

        // The fresh account is unverified, so the dashboard gate must show
        // the verification prompt — never the dashboard itself.
        await expect(page).toHaveURL(/verify-email/);

        // The test-only helper (registered for local/testing envs only in
        // bootstrap/app.php) returns the exact temporary-signed URL the
        // captured notification would have delivered. Navigating it runs the
        // production verification handler, not a test shortcut.
        const { url } = await page.request
            .get(`/__test/verification-url?email=${encodeURIComponent(email)}`)
            .then((r) => r.json());
        expect(url).toMatch(/\/verify-email\/\d+\//);

        await page.goto(url);
        await page.waitForURL(/\/dashboard/, { timeout: 30000 });

        // The dashboard (verified-only route) greets the freshly verified user.
        await expect(page.getByText("اتاق‌های من")).toBeVisible();
    });
});
