---
name: blocker-resilience-rules
description: How to detect and gracefully handle browser-blocked resources (ad-blockers, tracking protection, strict privacy extensions) in TamashaRoom — detection patterns, user messaging decision rules, and testing standards. Use when adding features loading external scripts/CDNs/embeds/WebSockets or when debugging client-side resource blocking.
---

# Blocker Resilience Rules

TamashaRoom runs in diverse client environments where content blockers, Enhanced Tracking Protection (ETP), aggressive VPN/firewall filters, and privacy extensions (uBlock Origin, Brave Shields, Privacy Badger) may intercept network requests, third-party scripts, CDNs, or WebSocket connections.

This skill establishes the rules for detecting blocked resources and deciding whether to fail silently via fallback or notify the user with actionable Persian guidance.

## 1. When to Apply This Pattern

Whenever designing or adding a feature that:
- Loads external or third-party resources (scripts, CDNs, external subtitles, video embeds, analytics, fonts).
- Establishes persistent real-time transports (Pusher/Reverb WebSockets).
- Interacts with browser storage or APIs frequently restricted in private/strict modes (`localStorage`, cookies, service workers).

**Ask upfront:** *"Could this resource or transport be blocked by a privacy extension or firewall? If blocked, does the user experience a broken blank screen, or is there a seamless fallback / clear explanation?"*

## 2. Established Detection Pattern

Follow the canonical implementation in [`resources/views/app.blade.php`](file:///c:/Users/Khashayar/Documents/TamashaRoom/resources/views/app.blade.php):

- **Immediate Detection (`onerror`):** Attach inline `onerror` event handlers to critical resource tags (`<script>`, `<link>`). Blocker-intercepted requests often reject immediately; inline handlers trigger fallback UI with near-zero latency.
- **Watchdog Timeout Fallback:** Pair `onerror` with a secondary watchdog timer (e.g. 3.5 seconds) to catch silent request stalls where the browser blocker suppresses error events and leaves the promise/tag hanging.
- **Narrow Detection Scope:** Detect *only* the specific resources TamashaRoom actually uses. Never inject generic bait assets (e.g. fake `ads.js` or dummy analytics scripts) that trigger false alarms or unnecessary blocker heuristics.

## 3. Decision Rule for User-Facing Messaging

| Scenario | Fallback Available? | User-Facing Message | Action |
|---|---|---|---|
| **Transport / Non-Fatal Block** (e.g. Pusher WebSocket blocked) | Yes (HTTP polling fallback) | **None (Silent)** | Transparently downgrade to tiered HTTP polling (`usePlaybackSync`, `usePresence`). Do not display warnings or interrupt the watch party. |
| **Optional Asset Block** (e.g. non-critical icon font, external poster) | Yes (local fallback font / placeholder) | **None (Silent)** | Gracefully render system fallback fonts or standard SVG icons. |
| **Critical Core Failure** (e.g. main application bundle blocked, essential feature blocked with no alternative) | No | **Actionable Persian Banner/Modal** | Display a clear, non-technical explanation in Persian advising the user to check their content blocker / add an exception. |

### UI & Styling Standards for Blocker Messages:
- Reuse the existing `#app-fallback-root` container and styling structure from `app.blade.php`.
- Follow the app's dark theme design system (`hsl(var(--background))`, `hsl(var(--muted-foreground))`, `hsl(var(--card))`).
- Use clear Persian phrasing with instructions (e.g. disabling tracking protection for this domain).

## 4. Testing Standards

Every blocker detection mechanism must have automated coverage in Playwright:
- **Blocked Path:** Simulate request aborts (`page.route('**/*.js', route => route.abort())`) to verify that the fallback banner appears promptly and accurately (see [`tests/e2e/fallback-loading.spec.ts`](file:///c:/Users/Khashayar/Documents/TamashaRoom/tests/e2e/fallback-loading.spec.ts)).
- **Normal Path (No False Positives):** Verify that slow or throttled networks that eventually resolve do *not* flash false blocker warnings.

## 5. Live Verification & Debugging Discipline

Never declare a blocker or visual fix complete based on code inspection alone:
- **Live Inspection Over Assumption:** Always verify with live browser inspection (Playwright screenshot, computed style check, or actual browser run).
- **Rule Out Stale Builds:** Check whether `npm run dev` (HMR) or `npm run build` is being served. A stale asset cache can produce false positives.
- **Engine Differences:** Be aware of Chromium vs Gecko/WebKit differences (e.g. Chromium disabling `::-webkit-scrollbar` when `scrollbar-width` is present; hardware compositing radius clipping on video layers).

## Related Skills
- `security-rules`: External URL validation and SSRF defenses.
- `error-handling-rules`: React error boundaries and API failure states.
- `debugging`: Runtime troubleshooting and known browser quirks.
- `testing-strategy`: Playwright E2E and network emulation layers.
