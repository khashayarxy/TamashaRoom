import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    testDir: ".",
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:8000",
        headless: true,
        launchOptions: {
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
    },
    webServer: {
        // php artisan serve is single-threaded by default; give it a few workers
        // so the browser context and polling don't serialize on one process.
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
});
