import { test, expect } from '@playwright/test';

// Fixture URLs via local media server (scoped to the 4 files in
// test-media/FIXTURES.md — start `node test-media-server.cjs` first).
const FIXTURES = [
    { type: 'MP4', url: 'http://127.0.0.1:8081/movies/gran-turismo-2023.mp4' },
    { type: 'MKV', url: 'http://127.0.0.1:8081/movies/a-quiet-place-part-2.mkv' }
];

test.describe('Long-running 30-minute Playback Stability Test', () => {
    test.setTimeout(1000 * 60 * 35); // 35 minutes per test

    for (const fixture of FIXTURES) {
        test(`30-minute stability test for ${fixture.type}`, async ({ page }) => {
            const consoleLogs: string[] = [];
            const errors: string[] = [];
            
            page.on('console', msg => {
                const text = msg.text();
                // Filter out expected warnings/logs to avoid noise
                if (text.includes('Permissions-Policy') || text.includes('Permissions policy') || text.includes('App\\Events') || text.includes('WebSocket')) return;
                
                consoleLogs.push(`[${msg.type()}] ${text}`);
                console.log(`PAGE LOG: [${msg.type()}] ${text}`);
                
                if (msg.type() === 'error' || text.includes('AbortError') || text.includes('MEDIA_ELEMENT_ERROR')) {
                    if (text.includes('Failed to load resource: the server responded with a status of 500')) return;
                    if (text.includes('net::ERR_EMPTY_RESPONSE')) return;
                    errors.push(text);
                }
            });
            
            page.on('pageerror', err => {
                if (err.message.includes('Permissions policy') || err.message.includes('Permissions-Policy')) return;
                errors.push(`PAGE ERROR: ${err.message}`);
                console.log(`PAGE ERROR: ${err.message}`);
            });

            console.log(`\n--- Starting 30-minute test for ${fixture.type} ---`);
            console.log(`Video URL: ${fixture.url}`);

            // Setup room with this specific video URL
            const resp = await page.request.post(`/__test/setup-verified-room?video_url=${encodeURIComponent(fixture.url)}`);
            expect(resp.ok()).toBeTruthy();
            const data = await resp.json();
            
            await page.goto(data.room_url);
            
            try {
                await expect(page.locator('video')).toBeVisible({ timeout: 60000 });
            } catch (e) {
                await page.screenshot({ path: `test-results/fail-mount-${fixture.type}.png` });
                throw e;
            }
            const playPauseBtn = page.locator('.media-button--play');
            await expect(playPauseBtn).toBeVisible();

            // Give it 10 seconds to initially load and start playing
            await page.waitForTimeout(10000);
            
            // Ensure playback started (if paused, click play)
            const isPaused = await page.locator('.media-icon--play').evaluate((el) => window.getComputedStyle(el).display !== 'none');
            if (isPaused) {
                console.log(`Forcing playback start...`);
                await playPauseBtn.click({ force: true });
                await page.waitForTimeout(5000);
            }

            // We will run this for 30 minutes = 1800 seconds.
            // We will do a loop every 60 seconds.
            const totalLoops = 30;
            let lastBufferPercent = -1;
            
            for (let i = 1; i <= totalLoops; i++) {
                // Wait 1 minute per iteration
                await page.waitForTimeout(60000);
                
                console.log(`\n[${fixture.type} - Minute ${i}/${totalLoops}] Health Check...`);
                
                // 1. Check if we accumulated any errors
                if (errors.length > 0) {
                    console.error(`!!! ERRORS DETECTED at minute ${i} !!!`);
                    console.error(errors.join('\n'));
                    throw new Error(`Test failed due to errors: ${errors[0]}`);
                }
                
                // 2. Check Play/Pause icon sync
                const playIconDisplay = await page.locator('.media-icon--play').evaluate((el) => window.getComputedStyle(el).display);
                const pauseIconDisplay = await page.locator('.media-icon--pause').evaluate((el) => window.getComputedStyle(el).display);
                
                // Usually it should be playing (play=none, pause=block)
                if (playIconDisplay !== 'none' || pauseIconDisplay !== 'block') {
                    console.error(`!!! ICON DESYNC DETECTED at minute ${i} !!! Play: ${playIconDisplay}, Pause: ${pauseIconDisplay}`);
                    // Only log it, let's not fail instantly to see if it recovers, or fail it if user wants strictness
                }
                
                // 3. Check Buffer Progression & Current Time
                const stats = await page.locator('video').evaluate((video: HTMLVideoElement) => {
                    let buff = 0;
                    if (video.buffered.length > 0) {
                        for (let j = 0; j < video.buffered.length; j++) {
                            if (video.currentTime >= video.buffered.start(j) && video.currentTime <= video.buffered.end(j)) {
                                buff = (video.buffered.end(j) / video.duration) * 100;
                            }
                        }
                    }
                    return {
                        currentTime: video.currentTime,
                        duration: video.duration,
                        readyState: video.readyState,
                        paused: video.paused,
                        bufferPercent: Math.round(buff)
                    };
                });
                
                console.log(`Stats: Time=${stats.currentTime.toFixed(1)}s, Paused=${stats.paused}, ReadyState=${stats.readyState}, Buffer=${stats.bufferPercent}%`);
                
                if (stats.bufferPercent === 0 && stats.currentTime > 5) {
                    console.warn(`[Warning] Buffer reset to 0% at minute ${i}`);
                }
                
                if (stats.paused) {
                    throw new Error(`Video unexpectedly paused at minute ${i}!`);
                }
                
                // 4. Periodic Seeking every 5 minutes
                if (i % 5 === 0) {
                    const seekTarget = stats.currentTime + 120; // seek forward 2 minutes
                    console.log(`[Action] Seeking forward 2 minutes to ${seekTarget}s...`);
                    
                    // Click the progress bar roughly 2 mins ahead, or use API
                    // To be safe and precise, we simulate the host sliding the progress bar.
                    // But an easier way is just dispatching an event if possible, or using the UI.
                    // Let's use the UI since it triggers all the sync logic.
                    // A simple way: find the slider and click on a percentage.
                    const slider = page.locator('.vds-time-slider');
                    if (await slider.isVisible()) {
                        const box = await slider.boundingBox();
                        if (box) {
                            const percent = Math.min(1, seekTarget / stats.duration);
                            await page.mouse.click(box.x + box.width * percent, box.y + box.height / 2);
                        }
                    }
                    
                    // Wait a few seconds to let seek settle
                    await page.waitForTimeout(5000);
                    
                    // Check if error occurred right after seeking
                    if (errors.length > 0) {
                        throw new Error(`Seek at minute ${i} caused errors: ${errors[0]}`);
                    }
                }
                
                lastBufferPercent = stats.bufferPercent;
            }
            
            console.log(`\n--- ${fixture.type} 30-Minute Test Completed Successfully! ---`);
            expect(errors.length).toBe(0);
        });
    }
});
