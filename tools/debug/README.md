# tools/debug — Ad-hoc Probe Scripts

Temporary, single-purpose debugging scripts that drive the real app/dev server
to inspect behavior a test can't easily assert. **These are scratch, not
tests.**

## Conventions

- Name probes `YYYY-MM-DD-<topic>.cjs` (e.g. `2026-08-05-guest-seek.cjs`).
- Require `./_harness.cjs` for the shared boilerplate (base URL, browser
  launch, auth context, room creation/join) — don't re-declare it.
- Probes that outlive their purpose should be promoted into a real regression
  test (see `testing-strategy`), then deleted.
- Every probe under this directory except `_harness.cjs` and `README.md` is
  gitignored. `_harness.cjs` is versioned because it is reusable
  infrastructure.

## The Harness (`_harness.cjs`)

Requires the dev server on port 8000 (`php artisan serve`). Provides:

- `launch()` / `newContext()` — headless Chromium + cookie-jar context.
- `createRoom(ctx, { localVideo, videoFile, ... })` — the `__test` room
  helper (sets the session cookie on `ctx`).
- `joinRoom(ctx, inviteCode, { forceNew })` — join as a genuinely distinct,
  non-owner guest.
- `playbackState(ctx, roomId)` — `GET /playback/{room}/state`.
- `openRoomContext(browser, roomOpts)` — context + room in one call.

```js
const H = require("./_harness.cjs");

(async () => {
    if (!(await H.assertServerRunning())) throw new Error("dev server not on :8000");
    const browser = await H.launch();
    const { ctx, room } = await H.openRoomContext(browser, { localVideo: true });
    // ... probe ...
    await browser.close();
})();
```

> Note: the `__test/*` routes exist only in `local`/`testing` environments.
