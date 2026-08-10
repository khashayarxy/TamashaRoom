// Shared Playwright base-URL resolution for TamashaRoom's test configs.
//
// Priority:
//   1. PLAYWRIGHT_BASE_URL env var (explicit override; wins over the probe).
//   2. https://tamasharoom.test  — the Laravel Herd local domain for this
//      project. Preferred when reachable because Herd terminates real HTTPS
//      via its own local CA (installed in the OS/browser trust store), so
//      SESSION_SECURE_COOKIE and other HTTPS-only behavior are exercised in
//      tests instead of being silently bypassed on plain http://127.0.0.1:8000.
//   3. http://127.0.0.1:8000      — the php artisan serve fallback, matching
//      the webServer command in every config.
//
// The reachability probe intentionally skips TLS validation: Node's cert store
// does not trust Herd's local CA (curl needs -k here too), but the browser the
// tests actually run in does. We only need to know whether the Herd server
// answers, not whether Node's bundle of roots happens to trust it.

import https from "node:https";

const HERD_BASE_URL = "https://tamasharoom.test";
const FALLBACK_BASE_URL = "http://127.0.0.1:8000";
const PROBE_TIMEOUT_MS = 2000;

/**
 * Quick reachability probe: does the Herd domain answer on HTTPS?
 * Any HTTP response — even 4xx/5xx or a redirect — means the server is up.
 * Only DNS failure, connection refusal, or timeout counts as unreachable.
 */
function probeHerdReachable() {
    return new Promise((resolve) => {
        const url = new URL(HERD_BASE_URL);
        const req = httpsRequest(url, PROBE_TIMEOUT_MS, () => resolve(true));
        req.on("error", () => resolve(false));
    });
}

function httpsRequest(url, timeoutMs, onResponse) {
    const req = https.get(
        {
            hostname: url.hostname,
            port: 443,
            path: "/",
            method: "HEAD",
            rejectUnauthorized: false,
            timeout: timeoutMs,
        },
        (res) => {
            res.resume();
            onResponse(res);
        },
    );
    req.on("timeout", () => req.destroy(new Error("probe timeout")));
    return req;
}

export async function resolveBaseUrl() {
    const override = process.env.PLAYWRIGHT_BASE_URL;
    if (override) {
        return override;
    }
    const herdUp = await probeHerdReachable();
    return herdUp ? HERD_BASE_URL : FALLBACK_BASE_URL;
}