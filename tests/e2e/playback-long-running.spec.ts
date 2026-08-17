import { test, expect } from "@playwright/test";

// Local-only stress test: serves real movie files from the machine's E:\Movies
// library via test-media-server.cjs (port 8081, scoped to the 4 files in
// test-media/FIXTURES.md). The fixtures and the server are gitignored and never
// exist on CI runners, so this file is skipped entirely there. Run it manually
// on a machine that has the media library + `node test-media-server.cjs` running.
//
// Default run length is 2 minutes (one health-check loop per minute) for fast
// local iteration. For a real pre-release soak, override the duration with the
// LONG_RUN_DURATION_MINUTES env var (e.g. `$env:LONG_RUN_DURATION_MINUTES=30`
// restores a full 30-minute run) without editing this file.
//
// The media server must already be up: `beforeAll` probes it and fails fast
// (in seconds, not the full test duration) with a clear message if it isn't.
test.skip(
    !!process.env.CI,
    "Requires local media server (test-media-server.cjs on 127.0.0.1:8081) and E:\\Movies fixtures",
);

const FIXTURES = [
    { type: "MP4", url: "http://127.0.0.1:8081/movies/gran-turismo-2023.mp4" },
    {
        type: "MKV",
        url: "http://127.0.0.1:8081/movies/a-quiet-place-part-2.mkv",
    },
];

// Configurable run length: 2 minutes by default, override with
// LONG_RUN_DURATION_MINUTES for a longer run (e.g. 5 or 30).
const LONG_RUN_DURATION_MINUTES = Number(
    process.env.LONG_RUN_DURATION_MINUTES ?? 2,
);

// Fail fast (seconds, not the full test duration) if the fixture media server
// is down or a fixture file is missing. Probes the server root, then requests
// a 1-byte range of each fixture (206 confirms it serves that file).
async function verifyMediaServer(): Promise<void> {
    const probe = async (url: string, headers?: Record<string, string>) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            return await fetch(url, { headers, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    let serverProbe: Response;
    try {
        serverProbe = await probe("http://127.0.0.1:8081/fixtures");
    } catch {
        throw new Error(
            "Media server on 127.0.0.1:8081 is not reachable. " +
                "Start it with `node test-media-server.cjs` before running this spec.",
        );
    }
    if (!serverProbe.ok) {
        throw new Error(
            `Media server responded with HTTP ${serverProbe.status}. ` +
                "Start it with `node test-media-server.cjs` before running this spec.",
        );
    }

    for (const fixture of FIXTURES) {
        let resp: Response;
        try {
            resp = await probe(fixture.url, { Range: "bytes=0-0" });
        } catch {
            throw new Error(
                `Fixture ${fixture.url} is not reachable. ` +
                    "Start `node test-media-server.cjs` and confirm the file exists in E:\\Movies.",
            );
        }
        if (resp.status !== 206) {
            throw new Error(
                `Fixture ${fixture.url} did not serve HTTP 206 (got ${resp.status}). ` +
                    "Is the file present in E:\\Movies?",
            );
        }
    }
}

test.beforeAll(verifyMediaServer);

test.describe(`Long-running ${LONG_RUN_DURATION_MINUTES}-minute Playback Stability Test`, () => {
    // Duration plus 5 minutes headroom (loop cadence + seek settle waits).
    test.setTimeout(1000 * 60 * (LONG_RUN_DURATION_MINUTES + 5));

    for (const fixture of FIXTURES) {
        test(`${LONG_RUN_DURATION_MINUTES}-minute stability test for ${fixture.type}`, async ({
            page,
        }) => {
            const consoleLogs: string[] = [];
            const errors: string[] = [];

            page.on("console", (msg) => {
                const text = msg.text();
                // Filter out expected warnings/logs to avoid noise
                if (
                    text.includes("Permissions-Policy") ||
                    text.includes("Permissions policy") ||
                    text.includes("App\\Events") ||
                    text.includes("WebSocket")
                )
                    return;

                consoleLogs.push(`[${msg.type()}] ${text}`);
                console.log(`PAGE LOG: [${msg.type()}] ${text}`);

                if (
                    msg.type() === "error" ||
                    text.includes("AbortError") ||
                    text.includes("MEDIA_ELEMENT_ERROR")
                ) {
                    if (
                        text.includes(
                            "Failed to load resource: the server responded with a status of 500",
                        )
                    )
                        return;
                    if (text.includes("net::ERR_EMPTY_RESPONSE")) return;
                    errors.push(text);
                }
            });

            page.on("pageerror", (err) => {
                if (
                    err.message.includes("Permissions policy") ||
                    err.message.includes("Permissions-Policy")
                )
                    return;
                errors.push(`PAGE ERROR: ${err.message}`);
                console.log(`PAGE ERROR: ${err.message}`);
            });

            console.log(
                `\n--- Starting ${LONG_RUN_DURATION_MINUTES}-minute test for ${fixture.type} ---`,
            );
            console.log(`Video URL: ${fixture.url}`);

            // Setup room with this specific video URL
            const resp = await page.request.post(
                `/__test/setup-verified-room?video_url=${encodeURIComponent(fixture.url)}`,
            );
            expect(resp.ok()).toBeTruthy();
            const data = await resp.json();

            await page.goto(data.room_url);

            try {
                await expect(page.locator("video")).toBeVisible({
                    timeout: 60000,
                });
            } catch (e) {
                await page.screenshot({
                    path: `test-results/fail-mount-${fixture.type}.png`,
                });
                throw e;
            }
            const playPauseBtn = page.locator(".media-button--play");
            await expect(playPauseBtn).toBeVisible();

            // Give it 10 seconds to initially load and start playing
            await page.waitForTimeout(10000);

            // Ensure playback started (if paused, click play)
            const isPaused = await page
                .locator(".media-icon--play")
                .evaluate(
                    (el) => window.getComputedStyle(el).display !== "none",
                );
            if (isPaused) {
                console.log(`Forcing playback start...`);
                await playPauseBtn.click({ force: true });
                await page.waitForTimeout(5000);
            }

            // Run for LONG_RUN_DURATION_MINUTES, checking health every 60
            // seconds (one loop per minute).
            const totalLoops = LONG_RUN_DURATION_MINUTES;
            let lastBufferPercent = -1;

            for (let i = 1; i <= totalLoops; i++) {
                // Wait 1 minute per iteration
                await page.waitForTimeout(60000);

                console.log(
                    `\n[${fixture.type} - Minute ${i}/${totalLoops}] Health Check...`,
                );

                // 1. Check if we accumulated any errors
                if (errors.length > 0) {
                    console.error(`!!! ERRORS DETECTED at minute ${i} !!!`);
                    console.error(errors.join("\n"));
                    throw new Error(`Test failed due to errors: ${errors[0]}`);
                }

                // 2. Check Play/Pause icon sync
                const playIconDisplay = await page
                    .locator(".media-icon--play")
                    .evaluate((el) => window.getComputedStyle(el).display);
                const pauseIconDisplay = await page
                    .locator(".media-icon--pause")
                    .evaluate((el) => window.getComputedStyle(el).display);

                // Usually it should be playing (play=none, pause=block)
                if (
                    playIconDisplay !== "none" ||
                    pauseIconDisplay !== "block"
                ) {
                    console.error(
                        `!!! ICON DESYNC DETECTED at minute ${i} !!! Play: ${playIconDisplay}, Pause: ${pauseIconDisplay}`,
                    );
                    // Only log it, let's not fail instantly to see if it recovers, or fail it if user wants strictness
                }

                // 3. Check Buffer Progression & Current Time
                const stats = await page
                    .locator("video")
                    .evaluate((video: HTMLVideoElement) => {
                        let buff = 0;
                        if (video.buffered.length > 0) {
                            for (let j = 0; j < video.buffered.length; j++) {
                                if (
                                    video.currentTime >=
                                        video.buffered.start(j) &&
                                    video.currentTime <= video.buffered.end(j)
                                ) {
                                    buff =
                                        (video.buffered.end(j) /
                                            video.duration) *
                                        100;
                                }
                            }
                        }
                        return {
                            currentTime: video.currentTime,
                            duration: video.duration,
                            readyState: video.readyState,
                            paused: video.paused,
                            bufferPercent: Math.round(buff),
                        };
                    });

                console.log(
                    `Stats: Time=${stats.currentTime.toFixed(1)}s, Paused=${stats.paused}, ReadyState=${stats.readyState}, Buffer=${stats.bufferPercent}%`,
                );

                if (stats.bufferPercent === 0 && stats.currentTime > 5) {
                    console.warn(`[Warning] Buffer reset to 0% at minute ${i}`);
                }

                if (stats.paused) {
                    throw new Error(
                        `Video unexpectedly paused at minute ${i}!`,
                    );
                }

                // 4. Periodic Seeking, scaled with run length (the original
                // 30-min run sought every 5 minutes; the default 2-min run
                // seeks every minute).
                const seekEveryMinutes = Math.max(
                    1,
                    Math.round(LONG_RUN_DURATION_MINUTES / 6),
                );
                if (i % seekEveryMinutes === 0) {
                    const seekTarget = stats.currentTime + 120; // seek forward 2 minutes
                    console.log(
                        `[Action] Seeking forward 2 minutes to ${seekTarget}s...`,
                    );

                    // Click the progress bar roughly 2 mins ahead, or use API
                    // To be safe and precise, we simulate the host sliding the progress bar.
                    // But an easier way is just dispatching an event if possible, or using the UI.
                    // Let's use the UI since it triggers all the sync logic.
                    // A simple way: find the slider and click on a percentage.
                    const slider = page.locator(".vds-time-slider");
                    if (await slider.isVisible()) {
                        const box = await slider.boundingBox();
                        if (box) {
                            const percent = Math.min(
                                1,
                                seekTarget / stats.duration,
                            );
                            await page.mouse.click(
                                box.x + box.width * percent,
                                box.y + box.height / 2,
                            );
                        }
                    }

                    // Wait a few seconds to let seek settle
                    await page.waitForTimeout(5000);

                    // Check if error occurred right after seeking
                    if (errors.length > 0) {
                        throw new Error(
                            `Seek at minute ${i} caused errors: ${errors[0]}`,
                        );
                    }
                }

                lastBufferPercent = stats.bufferPercent;
            }

            console.log(
                `\n--- ${fixture.type} ${LONG_RUN_DURATION_MINUTES}-Minute Test Completed Successfully! ---`,
            );
            expect(errors.length).toBe(0);
        });
    }
});
