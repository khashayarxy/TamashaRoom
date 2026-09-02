import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

import { resolveBaseUrl } from "../playwright-base-url.mjs";

const configDir = path.dirname(fileURLToPath(import.meta.url));

// https://tamasharoom.test when Herd is reachable (real HTTPS via Herd's local
// CA), else the php artisan serve fallback — see tests/playwright-base-url.mjs.
const baseURL = await resolveBaseUrl();

export default defineConfig({
    testDir: ".",
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: "list",
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                channel: "chrome",
                baseURL,
                headless: true,
                ignoreHTTPSErrors: true,
                launchOptions: {
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--proxy-server=direct://",
                    ],
                },
            },
        },
        {
            name: "firefox",
            use: {
                ...devices["Desktop Firefox"],
                baseURL,
                headless: true,
                ignoreHTTPSErrors: true,
            },
        },
        {
            name: "webkit",
            use: {
                ...devices["Desktop Safari"],
                baseURL,
                headless: true,
                ignoreHTTPSErrors: true,
            },
        },
        {
            name: "mobile-chrome",
            use: {
                ...devices["Pixel 5"],
                baseURL,
                headless: true,
                ignoreHTTPSErrors: true,
            },
        },
        {
            name: "mobile-safari",
            use: {
                ...devices["iPhone 13"],
                baseURL,
                headless: true,
                ignoreHTTPSErrors: true,
            },
        },
    ],
    webServer: {
        // php artisan serve is single-threaded by default; give it a few workers
        // so multiple browser contexts polling concurrently don't serialize on one
        // process (a common source of E2E flake).
        command: "php artisan serve --port=8000",
        env: {
            PHP_CLI_SERVER_WORKERS: "4",
            // Test server only: never hit the real Resend API from browser tests.
            // The VerifyEmail notification sends synchronously on registration, and
            // Resend rejects test addresses (@example.com) with a TransportException
            // that 500s POST /register. The array mailer captures it in memory; the
            // local/production .env (MAIL_MAILER=resend) is untouched.
            MAIL_MAILER: "array",
        },
        cwd: path.resolve(configDir, "../.."),
        url: "http://127.0.0.1:8000",
        reuseExistingServer: true,
        timeout: 30000,
    },
    globalSetup: "./globalSetup.mjs",
});
