/**
 * Shared debugging harness for TamashaRoom.
 *
 * Bundles the boilerplate the repo's probe scripts always repeat: pointing at
 * the local dev server, launching a headless browser, opening an
 * authenticated context, and creating/joining test rooms via the `__test`
 * helpers. A dated probe only needs to:
 *
 *   const H = require("./_harness.cjs");
 *   (async () => {
 *       const browser = await H.launch();
 *       const ctx = await H.newRoomContext(browser);
 *       const room = await H.createRoom(ctx, { localVideo: true });
 *       // ... probe logic ...
 *       await browser.close();
 *   })();
 *
 * Requires the dev server on PORT 8000 (`php artisan serve`). The `__test`
 * routes are gated to `local`/`testing` environments.
 */
const { chromium } = require("playwright");

const PORT = Number(process.env.TR_PORT ?? 8000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function assertServerRunning() {
    // Cheap liveness probe so a probe fails fast instead of hanging.
    const http = require("http");
    return new Promise((resolve) => {
        const req = http
            .get(`${BASE_URL}/`, (res) => {
                res.resume();
                resolve(true);
            })
            .on("error", () => resolve(false));
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Launch a headless Chromium. `args` extra flags can be passed for special
 * cases (e.g. disabling throttling for media capture).
 */
async function launch(args = []) {
    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", ...args],
    });
    return browser;
}

/**
 * Open a context whose cookie jar is used for both pages and API requests.
 * `context.request` shares the context's cookies, so a `__test` POST that
 * sets the session cookie also authenticates subsequent page navigations.
 */
async function newContext(browser, opts = {}) {
    const ctx = await browser.newContext({ baseURL: BASE_URL, ...opts });
    return ctx;
}

/** Create a room via `/__test/setup-verified-room`. Returns the JSON payload. */
async function createRoom(ctx, opts = {}) {
    const params = new URLSearchParams();
    if (opts.localVideo) params.set("local_video", "1");
    if (opts.videoFile) params.set("video_file", opts.videoFile);
    if (opts.withChat) params.set("with_chat", "1");
    if (opts.withGuest) params.set("with_guest", "1");
    if (opts.withSubtitle) params.set("with_subtitle", "1");
    const qs = params.toString();
    const resp = await ctx.request.post(
        `/__test/setup-verified-room${qs ? `?${qs}` : ""}`,
    );
    if (!resp.ok()) {
        throw new Error(
            `setup-verified-room failed (${resp.status()}): ${await resp.text()}`,
        );
    }
    return resp.json();
}

/**
 * Authenticate `ctx` into an existing room as a guest.
 * With `forceNew` (default true) a brand-new non-owner user is created so the
 * context is NOT the owner and does NOT get canControl.
 */
async function joinRoom(ctx, inviteCode, { forceNew = true } = {}) {
    const resp = await ctx.request.post(
        `/__test/join-room?${forceNew ? "force_new=1" : ""}`,
        { data: { invite_code: inviteCode } },
    );
    if (!resp.ok()) {
        throw new Error(`join-room failed (${resp.status()}): ${await resp.text()}`);
    }
    return resp.json();
}

/** GET the authoritative playback state for a room. */
async function playbackState(ctx, roomId) {
    const resp = await ctx.request.get(`/playback/${roomId}/state`);
    if (!resp.ok()) throw new Error(`playback state failed (${resp.status()})`);
    return resp.json();
}

/** Convenience: launch + context + (optionally) create a room in one call. */
async function openRoomContext(browser, roomOpts = {}) {
    const ctx = await newContext(browser);
    const room = await createRoom(ctx, roomOpts);
    return { ctx, room };
}

module.exports = {
    PORT,
    BASE_URL,
    assertServerRunning,
    launch,
    newContext,
    createRoom,
    joinRoom,
    playbackState,
    openRoomContext,
};
