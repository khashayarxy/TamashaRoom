import { test, expect } from "@playwright/test";

/**
 * A locked room must never fail silently on join — regardless of the entry
 * point (direct invite link, code entry, bookmark, QR code). The join page
 * announces the lock up front with a disabled join button, and members are
 * never locked out of the room itself (locking only blocks new joins).
 */
test.describe("Locked room join UX", () => {
    test("locked invite link shows a lock notice and a disabled join button; members still get in", async ({
        browser,
    }) => {
        const hostCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const hostPage = await hostCtx.newPage();
        const resp = await hostPage.request.post(
            "/__test/setup-verified-room?locked=1",
        );
        expect(resp.ok()).toBeTruthy();
        const { room_url, invite_code } = await resp.json();

        // The owner (a member) can still open the room directly — including
        // after a refresh while the room is locked.
        await hostPage.goto(room_url);
        await expect(
            hostPage.getByRole("heading", { name: "Test Room" }),
        ).toBeVisible();
        await hostPage.reload();
        await expect(
            hostPage.getByRole("heading", { name: "Test Room" }),
        ).toBeVisible();

        // A fresh visitor opening the invite link gets a clear notice — not
        // silence — and cannot submit the disabled join button.
        const guestCtx = await browser.newContext({
            baseURL: "http://127.0.0.1:8000",
        });
        const guestPage = await guestCtx.newPage();
        await guestPage.goto(`/rooms/join/${invite_code}`);

        const alert = guestPage.getByRole("alert");
        await expect(alert).toContainText("قفل");
        await expect(
            guestPage.getByRole("button", { name: "پیوستن به اتاق" }),
        ).toBeDisabled();
    });
});
