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
    },
    cwd: path.resolve(configDir, "../.."),
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
