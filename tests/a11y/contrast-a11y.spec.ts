import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

/**
 * Deterministic room-page readiness. A room page with a video + live polling
 * never reaches `networkidle` (media fetches, playback-sync polls, presence
 * heartbeats), so the old `waitForLoadState("networkidle")` after navigation
 * was load-dependent and could time out before the tab-bar buttons render.
 * The tab bar ("چت"/"اعضا") is part of the first paint, so waiting on it is the
 * correct barrier — axe scans the DOM, it does not need the network settled.
 */
async function waitForRoom(page: Page): Promise<void> {
    await page.getByRole("button", { name: "چت" }).waitFor();
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

    test("Responsive nav (mobile viewport, menu open)", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/__test/setup-verified-room");
        await page.waitForLoadState("networkidle");
        await page.goto("/profile");
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/profile");

        // AuthenticatedLayout is the only layout rendering ResponsiveNavLink;
        // its hamburger is the only visible <button> in <nav> at this width.
        await page.locator("nav button:visible").click();
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
        await page.goto("/__test/setup-verified-room?" + params.toString());
        await page.waitForLoadState("networkidle");
        const data = JSON.parse(
            await page.evaluate(() => document.body.innerText),
        );
        const roomUrl = new URL(data.room_url).pathname;

        await page.goto(roomUrl);
        await waitForRoom(page);

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

        const gotoRoom = async () => {
            await page.goto("/__test/setup-verified-room?" + params.toString());
            await page.waitForLoadState("networkidle");
            const data = JSON.parse(
                await page.evaluate(() => document.body.innerText),
            );
            const roomUrl = new URL(data.room_url).pathname;
            await page.goto(roomUrl);
            await waitForRoom(page);
        };

        for (const [theme, dark] of [
            ["dark", true],
            ["light", false],
        ] as const) {
            await gotoRoom();
            await setTheme(page, dark);
            await page.getByRole("button", { name: "زیرنویس" }).click();
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
            await gotoRoom();
            await setTheme(page, dark);
            await page.getByRole("button", { name: "کپی لینک دعوت" }).click();
            await page.getByText("لینک دعوت کپی شد.").waitFor();
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

        const gotoRoom = async () => {
            await page.goto("/__test/setup-verified-room?" + params.toString());
            await page.waitForLoadState("networkidle");
            const data = JSON.parse(
                await page.evaluate(() => document.body.innerText),
            );
            const roomUrl = new URL(data.room_url).pathname;
            await page.goto(roomUrl);
            await waitForRoom(page);
        };

        for (const [theme, dark] of [
            ["dark", true],
            ["light", false],
        ] as const) {
            // Room settings dialog (opened from the members tab)
            await gotoRoom();
            await setTheme(page, dark);
            await page.getByRole("button", { name: "اعضا" }).click();
            await page.getByRole("button", { name: "تنظیمات اتاق" }).click();
            await page
                .getByRole("heading", { name: "تنظیمات اتاق" })
                .waitFor();
            let violations = await contrastViolations(page);
            expect(
                violations,
                `room settings dialog (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);
            await page.keyboard.press("Escape");
            await page.locator("dialog[open]").waitFor({ state: "hidden" });

            // Subtitle settings dialog (requires an active track)
            await page.getByRole("button", { name: "زیرنویس" }).click();
            await page.getByRole("button", { name: "بدون زیرنویس" }).waitFor();
            await page.getByRole("button", { name: "فارسی" }).click();
            await page
                .getByRole("button")
                .filter({ has: page.locator("svg.lucide-x") })
                .click();
            await page
                .getByRole("button", { name: "تنظیمات", exact: true })
                .filter({ hasText: "تنظیمات" })
                .click();
            await page
                .getByRole("heading", { name: "تنظیمات زیرنویس" })
                .waitFor();
            violations = await contrastViolations(page);
            expect(
                violations,
                `subtitle settings dialog (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);

            // Non-zero sync offset reveals the "بازنشانی" reset link. Scope to
            // the open dialog: the room page's video player exposes its own
            // range/seekbar controls outside the dialog.
            const offsetSlider = page.locator(
                'dialog[open] input[type="range"][max="5000"]',
            );
            await offsetSlider.focus();
            await page.keyboard.press("ArrowRight");
            await page
                .getByRole("button", { name: "بازنشانی" })
                .waitFor();
            violations = await contrastViolations(page);
            expect(
                violations,
                `subtitle settings reset link (${theme}):\n${formatViolations(violations)}`,
            ).toEqual([]);

            await page.keyboard.press("Escape");
            await page.locator("dialog[open]").waitFor({ state: "hidden" });

            // Confirm dialog (subtitle track delete)
            await page.getByRole("button", { name: "زیرنویس" }).click();
            await page.getByRole("button", { name: "بدون زیرنویس" }).waitFor();
            await page.getByRole("button", { name: "حذف", exact: true }).click();
            await page
                .getByRole("heading", { name: "حذف زیرنویس" })
                .waitFor();
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
