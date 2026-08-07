import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Playwright globalSetup for the E2E suite.
 *
 * Starts a draining `php artisan queue:work` alongside the dev server so the
 * pusher-mode suite (BROADCAST_CONNECTION=pusher) gets broadcast events
 * delivered within ~1s. Broadcasts are queued to the database and the worker
 * makes the outbound Pusher HTTPS calls — never the web server, which would
 * stall every request behind a ~1.5s synchronous network call.
 *
 * This is deliberately a globalSetup (not part of the webServer command):
 * the webServer uses `reuseExistingServer: true` to reuse a developer's own
 * running `php artisan serve`, in which case a webServer command never runs.
 * The worker is needed regardless of where the server came from.
 *
 * With BROADCAST_CONNECTION=null (CI), the worker drains queued no-op
 * broadcasts and is harmless.
 */

const PROJECT_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

export default async function globalSetup() {
    const worker = spawn("php", ["artisan", "queue:work", "--tries=3"], {
        cwd: PROJECT_ROOT,
        env: process.env,
        stdio: "inherit",
    });

    worker.on("exit", (code) => {
        if (code && code !== 0) {
            // Surface worker crashes; a dead worker silently breaks broadcast
            // delivery and produces confusing push-mode failures.
            console.error(
                `[globalSetup] queue:work exited unexpectedly with code ${code}`,
            );
        }
    });

    return async () => {
        try {
            worker.kill();
        } catch {
            // already gone
        }
    };
}
