import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gotoRoom } from "./room-nav";

/**
 * Dedicated WCAG 2.2 AA color-contrast audit.
 *
 * Unlike the other a11y specs (which scan only the default dark theme and
 * filter to critical/serious impact), this suite runs the `color-contrast`
 * rule with NO impact filtering across BOTH themes and over key interactive
 * states (open dialogs, the subtitle manager, toasts) — the coverage that a
 * light-mode contrast regression would otherwise slip through.
 */

type AxeNode = {
    target: string[];
    html: string;
    failureSummary?: string;
    any: Array<{ message: string; data?: Record<string, unknown> }>;
};

type Violation = {
    id: string;
    impact?: string;
    help: string;
    nodes: AxeNode[];
};

async function setTheme(page: Page, dark: boolean): Promise<void> {
    await disableTransitions(page);
    await page.evaluate((isDark) => {
        localStorage.setItem("theme", isDark ? "dark" : "light");
        document.documentElement.classList.toggle("dark", isDark);
    }, dark);
    // The app collapses theme transitions to 0.01ms under reduced motion, but
    // under suite load axe can still sample colors while style recalculation
    // from the class toggle settles, producing false mid-transition ratios.
    // Force the recompute and wait two frames so the scan sees settled tokens.
    await page.evaluate(() => {
        void document.documentElement.offsetHeight;
        return new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
    });
}

async function contrastViolations(page: Page): Promise<Violation[]> {
    const results = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
    return results.violations as Violation[];
}

function formatViolations(violations: Violation[]): string {
    return violations
        .map((violation) => {
            const nodes = violation.nodes
                .map((node) => {
                    const contrast = node.any.find(
                        (item) => item.data?.contrastRatio !== undefined,
                    );
                    const data = contrast?.data;
                    const details = data
                        ? `ratio=${data.contrastRatio} expected>=${data.expectedContrastRatio} fg=${data.fgColor} bg=${data.bgColor}`
                        : "";
                    const snippet = node.html
                        .replace(/\s+/g, " ")
                        .slice(0, 140);
                    return `    ${node.target.join(" ")}\n      ${snippet}\n      ${details}\n      ${node.failureSummary ?? ""}`;
                })
                .join("\n");
            return `  [${violation.impact ?? "n/a"}] ${violation.id} — ${violation.help}\n${nodes}`;
        })
        .join("\n\n");
}

async function expectBothThemesContrastSafe(page: Page): Promise<void> {
    for (const [theme, dark] of [
        ["dark", true],
        ["light", false],
    ] as const) {
        await setTheme(page, dark);
        const violations = await contrastViolations(page);
        expect(
            violations,
            `${theme} mode contrast failures:\n${formatViolations(violations)}`,
        ).toEqual([]);
    }
}

// Disable CSS transitions while toggling themes: button/tab transitions
// (transition-all/transition-colors) interpolate colors for ~150ms, which axe can
// sample mid-flight and report as a false contrast failure. Preferring to rely on
// PREFERS-REDUCED-MOTION (Playwright's `reducedMotion`) does not hold on every
// browser channel (e.g. `channel: "chrome"` does not emulate the media query), so
// setTheme injects a stylesheet that hard-disables transitions and animations.
// The scan values are then always settled tokens.
test.use({ reducedMotion: "reduce" });

async function disableTransitions(page: Page): Promise<void> {
    await page.addStyleTag({
        content: "*{transition:none !important;animation:none !important}",
    });
}

/**
 * Reveal the player control bar before clicking one of its buttons.
 *
 * Video.js (@videojs/react) auto-hides the control bar ~2s after the last
 * pointer move over the player: `.media-controls--root` loses its
 * `data-visible` attribute (its `ControlsDataAttrs.visible` state) and the
 * bars fade to `opacity: 0` + `pointer-events: none`. The bars are additionally
 * forced `visibility: hidden` while a media-error dialog is open. `force: true`
 * cannot pierce either state — Playwright still needs a visible box to
 * scroll-into-view and dispatch the click. So instead: dismiss any media-error
 * dialog, then hover the player and wait for the framework's own visible-state
 * attribute before clicking.
 */
async function revealPlayerControls(page: Page): Promise<void> {
    const mediaError = page.locator(".media-error");
    // The room fixture's media source is mocked to load successfully
    // (installPlayableVideoMock in room-nav.ts), so no error dialog should
    // appear. If one somehow does, dismiss it defensively before revealing.
    if (await mediaError.isVisible()) {
        await page.locator(".media-error button").click({ timeout: 5_000 });
        await mediaError.waitFor({ state: "hidden", timeout: 5_000 });
    }

    const player = page.locator(".media-default-skin--video");
    await player.hover();
    await page.locator(".media-controls--root[data-visible]").waitFor();
}

test.describe("Color-contrast audit (WCAG AA, both themes)", () => {
    test("Welcome landing page", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await expectBothThemesContrastSafe(page);
    });

    test("Auth pages", async ({ page }) => {
        for (const route of ["/login", "/register", "/forgot-password"]) {
            await page.goto(route);
            await page.waitForLoadState("networkidle");
            await expectBothThemesContrastSafe(page);
        }
    });

    test("Dashboard", async ({ page }) => {
        await page.goto("/__test/setup-verified-room");
        await page.waitForLoadState("networkidle");
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/dashboard");
        await expectBothThemesContrastSafe(page);
    });

    test("Responsive nav (mobile viewport)", async ({ page }) => {
        await page.setViewportSize({ width: 640, height: 844 });
        await page.goto("/__test/setup-verified-room");
        await page.waitForLoadState("networkidle");
        await page.goto("/profile");
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/profile");

        // AppLayout nav items use `hidden sm:flex` — visible at ≥640px.
        await page
            .getByRole("link", { name: "داشبورد" })
            .waitFor({ state: "visible" });
        await expectBothThemesContrastSafe(page);
    });

    test("Populated room page (chat + members tabs)", async ({ page }) => {
        const params = new URLSearchParams({
            with_video: "1",
            with_chat: "1",
            with_subtitle: "1",
            with_guest: "1",
        });
        await gotoRoom(page, params);

        await expectBothThemesContrastSafe(page);

        await page.getByRole("button", { name: "اعضا" }).click();
        await expectBothThemesContrastSafe(page);
    });

    test("Room open states (subtitle manager + toast)", async ({ page }) => {
        const params = new URLSearchParams({
            with_video: "1",
            with_chat: "1",
            with_subtitle: "1",
            with_guest: "1",
        });

        for (const [theme, dark] of [
            ["dark", true],
            ["light", false],
        ] as const) {
            await gotoRoom(page, params);
            await setTheme(page, dark);
            // Exact name: the player gear menu's "تنظیمات زیرنویس" item shares
            // the "زیرنویس" substring and can be in the a11y tree when the menu
            // was left open, making the substring locator ambiguous.
            await page
                .getByRole("button", { name: "زیرنویس", exact: true })
                .click();
            await page.getByRole("button", { name: "بدون زیرنویس" }).waitFor();
            const violations = await contrastViolations(page);
            expect(
                violations,
                `subtitle manager (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);
        }

        for (const [theme, dark] of [
            ["dark", true],
            ["light", false],
        ] as const) {
            await gotoRoom(page, params);
            await setTheme(page, dark);
            await page.getByRole("button", { name: "تنظیمات اتاق" }).click();
            await page.getByRole("heading", { name: "تنظیمات اتاق" }).waitFor();
            await page.getByTitle("کپی لینک").click();
            await page.getByText("لینک دعوت کپی شد").waitFor();
            const violations = await contrastViolations(page);
            expect(
                violations,
                `toast visible (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);
        }
    });

    test("Room dialogs (settings + subtitle settings + confirm)", async ({
        page,
    }) => {
        // This test performs 8 full-page color-contrast scans across 4 dialog
        // states x both themes, with a fresh room setup per theme (2 rooms).
        // Measured ~10s on system Chrome; CI's single-core bundled headless
        // Chromium routinely exceeds the 30s default budget, so the چت wait in
        // the second gotoRoom runs out of clock. The scans are irreplaceable
        // coverage, so scope the budget to this one test instead of retrying.
        test.setTimeout(60_000);
        const params = new URLSearchParams({
            with_video: "1",
            with_chat: "1",
            with_subtitle: "1",
            with_guest: "1",
        });

        for (const [theme, dark] of [
            ["dark", true],
            ["light", false],
        ] as const) {
            // Room settings dialog (opened from top bar above player)
            await gotoRoom(page, params);
            await setTheme(page, dark);
            await page.getByRole("button", { name: "تنظیمات اتاق" }).click();
            await page.getByRole("heading", { name: "تنظیمات اتاق" }).waitFor();
            let violations = await contrastViolations(page);
            expect(
                violations,
                `room settings dialog (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);
            await page.keyboard.press("Escape");
            await page.locator("dialog[open]").waitFor({ state: "hidden" });

            // Subtitle settings dialog (requires an active track).
            // Entry point is the player gear menu → "تنظیمات زیرنویس".
            // The standalone "تنظیمات" button was removed in c5d5b2f when
            // the subtitle settings trigger moved into the player gear menu.
            await page
                .getByRole("button", { name: "زیرنویس", exact: true })
                .click();
            await page.getByRole("button", { name: "بدون زیرنویس" }).waitFor();
            await page.getByRole("button", { name: "فارسی" }).click();
            await page
                .getByRole("button")
                .filter({ has: page.locator("svg.lucide-x") })
                .click();
            await page.locator("dialog[open]").waitFor({ state: "hidden" });

            // If the mock video URL triggered a media format error dialog, dismiss it.
            const playerErrorClose = page.locator(
                ".media-error button, .media-error .media-button, .media-dialog--alert button",
            );
            if (await playerErrorClose.isVisible()) {
                await playerErrorClose.click();
            }

            // Open the player gear/settings menu, then trigger subtitle settings.
            // Reveal the auto-hiding control bar first (dismiss any media-error
            // dialog, hover the player, wait for `[data-visible]`), then click
            // normally — `force: true` cannot pierce the hidden control bar.
            await revealPlayerControls(page);
            await page.locator(".media-button--settings").click();
            await page.getByRole("button", { name: "تنظیمات زیرنویس" }).click();
            await page
                .getByRole("heading", { name: "تنظیمات زیرنویس" })
                .waitFor();
            violations = await contrastViolations(page);
            expect(
                violations,
                `subtitle settings dialog (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);

            // Non-zero sync offset reveals the "بازنشانی هم‌زمانی" reset link.
            // The offset slider is on the "پیشرفته" tab (subtitle settings redesign).
            // Scope the range selector to the open dialog: the room player also
            // has range/seekbar controls outside the dialog.
            await page.getByRole("tab", { name: "پیشرفته" }).click();
            const offsetSlider = page.locator(
                'dialog[open] input[type="range"][max="5000"]',
            );
            await offsetSlider.focus();
            await page.keyboard.press("ArrowRight");
            await page
                .getByRole("button", { name: "بازنشانی هم‌زمانی" })
                .waitFor();
            violations = await contrastViolations(page);
            expect(
                violations,
                `subtitle settings reset link (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);

            await page.keyboard.press("Escape");
            await page.locator("dialog[open]").waitFor({ state: "hidden" });

            // Confirm dialog (subtitle track delete).
            // The gear menu may still be open here (its "تنظیمات زیرنویس" item
            // would match the substring), so the top-bar button needs an exact name.
            await page
                .getByRole("button", { name: "زیرنویس", exact: true })
                .click();
            await page.getByRole("button", { name: "بدون زیرنویس" }).waitFor();
            await page
                .getByRole("button", { name: "حذف", exact: true })
                .click();
            await page.getByRole("heading", { name: "حذف زیرنویس" }).waitFor();
            violations = await contrastViolations(page);
            expect(
                violations,
                `confirm dialog (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);
            await page.keyboard.press("Escape");
            await page.locator("dialog[open]").waitFor({ state: "hidden" });
        }
    });

    test("Profile delete-account dialog (open)", async ({ page }) => {
        await page.goto("/__test/setup-verified-room");
        await page.waitForLoadState("networkidle");
        await page.goto("/profile");
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/profile");

        for (const [theme, dark] of [
            ["dark", true],
            ["light", false],
        ] as const) {
            await setTheme(page, dark);
            await page.getByRole("button", { name: "حذف حساب کاربری" }).click();
            await page.getByRole("dialog").waitFor();
            const violations = await contrastViolations(page);
            expect(
                violations,
                `delete dialog (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "hidden" });
        }
    });
});
