import { test, expect } from "@playwright/test";

test.describe("Profile dialog", () => {
    test("header avatar opens a centered dialog with all profile sections", async ({
        page,
    }) => {
        await page.request.post("/__test/setup-verified-room");
        await page.goto("/dashboard");

        // The AppLayout header avatar button carries aria-haspopup="dialog".
        const avatarButton = page.locator(
            'button[aria-haspopup="dialog"]',
        );
        await expect(avatarButton).toBeVisible();
        await avatarButton.click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "پروفایل", exact: true }),
        ).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "اطلاعات پروفایل" }),
        ).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "به‌روزرسانی رمز عبور" }),
        ).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "حذف حساب کاربری" }),
        ).toBeVisible();
    });

    test("delete-account row links out to the intact /profile page", async ({
        page,
    }) => {
        await page.request.post("/__test/setup-verified-room");
        await page.goto("/dashboard");
        await page.locator('button[aria-haspopup="dialog"]').click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "حذف حساب کاربری" }),
        ).toBeVisible();

        // Account deletion lives on /profile (embedding DeleteUserForm's
        // legacy modal inside this native dialog breaks its cancel path —
        // verified during development). The row navigates there instead.
        await dialog
            .getByRole("button", { name: "رفتن به صفحه پروفایل" })
            .click();
        await page.waitForURL("**/profile");
        await expect(page.getByRole("dialog")).toBeHidden();
        await expect(
            page.getByRole("heading", { name: "حذف حساب کاربری" }),
        ).toBeVisible();
    });
});
