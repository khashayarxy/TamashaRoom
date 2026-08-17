# ISSUE_REGISTER.md

> **The current known issue state for TamashaRoom.** This is the authoritative
> register for issues that have been through the verification loop. It does not
> blindly copy every finding from an AI report — only findings supported by the
> verification material are included.
>
> Every entry carries two independent concepts:
> - **Verification** — how certain we are that the issue is real (evidence-based)
> - **Status** — what we are doing about it (resolution state)
>
> An issue can be `CONFIRMED` (real) while its status is `OPEN`, `WONT_FIX`, or
> `RESOLVED`. These are separate axes and must not be merged.
>
> This register is updated by Web AI / the human after Desktop AI verification.
> Desktop AI never edits this file. See `workflow/VERIFY.md`.
>
> Engineering rules that prevent issues are tracked separately in
> `ENGINEERING_GUARDRAILS.md`, not in this register.

---

## Verification Values

| Value | Meaning |
|---|---|
| `CONFIRMED` | Verified against the actual source code / documentation with supporting evidence |
| `LIKELY` | Strongly indicated but not fully verified |
| `UNVERIFIED` | Reported but not confirmed against the source |
| `FALSE_POSITIVE` | Investigated and shown not to be an issue |

## Status Values

| Value | Meaning |
|---|---|
| `OPEN` | Acknowledged, not being worked on yet |
| `IN_PROGRESS` | A fix is being implemented |
| `RESOLVED` | Fixed and verified |
| `WONT_FIX` | Known and deliberately accepted (still a real issue, intentionally not fixed) |

## Severity Values

| Severity | Meaning |
|---|---|
| `P0` | Production Blocker — prevents deploy or breaks core function in production |
| `P1` | Critical — serious security/functional issue, must fix before production |
| `P2` | Important — should fix, has workaround or moderate impact |
| `P3` | Minor — low impact, cosmetic, or tech debt |

---

## Active Issues (OPEN / IN_PROGRESS / WONT_FIX)

### TAM-001 — SSRF TOCTOU gap in video proxy

- **ID:** TAM-001
- **Title:** DNS rebinding race between URL validation and actual stream fetch
- **Category:** Security
- **Severity:** P2
- **Verification:** CONFIRMED
- **Status:** WONT_FIX
- **Confidence:** High
- **Area:** `VideoProxyService`, `UrlSecurityService`
- **Evidence:** `docs/TASK.md` "Accepted MVP Limitations" documents the gap: DNS
  resolution and IP checks run once at the top of `VideoProxyService::stream()`;
  a DNS rebinding attack could pass validation for a safe IP and resolve to an
  internal IP by the time `get_headers()`/`fopen()` runs. Window is microseconds;
  proxy requires auth.
- **Impact:** Theoretical SSRF via DNS rebinding. Low practical risk for MVP;
  not acceptable post-MVP.
- **Production blocking:** No (accepted for MVP).
- **Recommended direction:** Post-MVP: resolve hostname synchronously, compare
  resolved IP against the blocklist inside every stream context
  (`stream_context_set_param` wrapper), fail on mismatch.
- **Verification source:** `docs/TASK.md` (Accepted MVP Limitations); source
  reviewed in this pass (`UrlSecurityService` confirms single-pass validation).
- **Notes:** Tracked as accepted tech debt with a documented post-MVP fix.

---

### TAM-002 — Migration count discrepancy (13 vs 14)

- **ID:** TAM-002
- **Title:** `docs/deployment-checklist.md` says "13 migrations", migrations dir has 14 files
- **Category:** Documentation
- **Severity:** P3
- **Verification:** CONFIRMED
- **Status:** RESOLVED (2026-08-01, Batch 2A)
- **Confidence:** High
- **Area:** Documentation / deployment
- **Evidence:** At the 2026-08-01 resolution, `database/migrations/` contained
  **13** files (3 framework base + 10 application), and the deployment checklist
  was corrected to match. A later `2026-08-03` active-subtitle migration brings
  the current directory to **14** files; the current deployment checklist now
  reflects that later state, so the original documentation discrepancy remains
  resolved.
- **Impact:** Resolved — the count is correct everywhere.
- **Production blocking:** No.
- **Recommended direction:** None — the current count is 14 in both the
  migrations directory and deployment checklist.
- **Verification source:** Directory listing (this pass) vs. deployment-checklist.md.
- **Notes:** Resolved by Batch 2A; the later migration changed the count without
  reintroducing a documentation mismatch.

---

### TAM-003 — Subtitle content sanitization has no explicit test

- **ID:** TAM-003
- **Title:** No explicit XSS/content sanitization test for subtitle rendering
- **Category:** Security / Testing
- **Severity:** P2
- **Verification:** CONFIRMED (historically reported as LIKELY)
- **Status:** RESOLVED (2026-08-01, Batch 2B)
- **Confidence:** Medium
- **Area:** Frontend subtitle rendering; backend subtitle content
- **Evidence:** Historical report: `docs/TASK.md` Test Coverage Gaps listed
  "Subtitle content sanitization — no explicit XSS/content sanitization; relies
  on browser's VTT-safe rendering" as an *unresolved* gap at that time, with
  `sanitizeText()` already applied at subtitle boundaries per quality-report.md.
  Current status: explicit sanitization tests now exist in source — backend
  `extractCues` strips script/`onerror` payloads (unit, tests/Unit/SubtitleConverterTest.php),
  upload→`/cues` sanitization + `text/vtt` content-type (feature, tests/Feature/SubtitleTest.php),
  frontend `parseVtt`/`parseSrt` strip script/img/javascript: payloads (parser), and
  overlay renders script-like cues as escaped text (render).
- **Impact:** Resolved — regression coverage added (Batch 2B, TAM-003).
- **Production blocking:** No.
- **Recommended direction:** None — coverage added (Batch 2B, TAM-003).
- **Verification source:** Historical verification (2026-08-01): `docs/TASK.md`,
  `quality-report.md`, and source inspection of the test files above. Independent
  verification (2026-08-02, Batch G8): the full PHPUnit suite (194/194 passed,
  incl. `SubtitleConverterTest` and `SubtitleTest`) and the full Vitest suite
  (122/122 passed, incl. the subtitle-parser and subtitle-overlay files) were run
  and pass in this pass — execution confirmed by an actual test run, not inferred.
- **Notes:** The historical verification uncertainty (LIKELY) predates Batch 2B and
  is superseded by the current CONFIRMED status; the issue is not active. The
  2026-08-01 source-inspection verification is distinct from — and now confirmed
  by — the 2026-08-02 independent test run.

---

### TAM-004 — A11y coverage gaps on auth/profile pages

- **ID:** TAM-004
- **Title:** Profile, password-reset, and verify-email pages lack axe coverage
- **Category:** Accessibility
- **Severity:** P3
- **Verification:** CONFIRMED
- **Status:** RESOLVED (2026-08-01, Batch 2D)
- **Confidence:** High
- **Area:** Frontend a11y test suite
- **Evidence:** `docs/TASK.md` Test Coverage Gaps: "Profile, password-reset,
  verify-email a11y — pages uncovered."
- **Impact:** Resolved — axe coverage added for `/reset-password/{token}`,
  `/confirm-password`, and the Profile delete-account modal open state; the full
  a11y suite is 19/19 passing (expanded from 11/11 in contrast pass).
- **Production blocking:** No.
- **Recommended direction:** None — coverage added (Batch 2D, TAM-004).
- **Verification source:** `docs/TASK.md`.
- **Notes:** A11y suites exist for welcome, auth (login/register), and room.

---

### TAM-005 — Room ownership-transfer UX polish (RESOLVED — Batch 2C)

- **ID:** TAM-005
- **Title:** Member list does not fully refresh after ownership transfer
- **Category:** UX / Functional
- **Severity:** P3
- **Verification:** CONFIRMED
- **Status:** RESOLVED (2026-08-01, Batch 2C)
- **Confidence:** Medium
- **Area:** Frontend `member-list` / `Rooms/Show`
- **Evidence:** Historical issue (originally titled "Room ownership-transfer UX polish pending"): `docs/TASK.md` Future Features listed "Room ownership transfer UX polish (update member list after transfer)". The backend transfer path works and is E2E-tested (lock-kick-transfer 4/4).
- **Impact:** Resolved — `useRoomOwnership` hook makes ownership state reactive
  (`room-ui` store); the old owner loses owner-only controls immediately, the new
  owner adopts ownership from presence data, and failed transfers leave state
  untouched.
- **Production blocking:** No.
- **Recommended direction:** None — resolved (Batch 2C, TAM-005).
- **Verification source:** `docs/TASK.md`.
- **Notes:** Backend complete; UX polish now done.

---

### TAM-006 — Deployment steps not executed on production

- **ID:** TAM-006
- **Title:** No production deployment executed (migrations, scheduler cron, queue drain, environment)
- **Category:** Operations / Deployment
- **Severity:** P0
- **Verification:** CONFIRMED
- **Status:** OPEN
- **Confidence:** High
- **Area:** Production environment
- **Evidence:** `docs/TASK.md` "Deployment Readiness": migrations not executed on
  production, the single cPanel `schedule:run` cron entry (which fans out to the scheduled tasks — including the
  `queue:work --stop-when-empty --max-time=30` batch drain) not configured, and
  `APP_DEBUG=false` / `APP_ENV=production` not confirmed on production.
- **Impact:** The app cannot run in production until these are done (scheduled
  tasks depend on the cron entry; subtitle files use the private `local` disk
  and do not require a public storage symlink). No persistent worker is needed — queue draining is handled by the
  scheduled `schedule:run` tick.
- **Production blocking:** Yes — these are P0 for an actual launch.
- **Recommended direction:** Follow `docs/deployment-checklist.md` end-to-end and
  verify each item (section 7 checks).
- **Verification source:** `docs/TASK.md`.
- **Notes:** Recorded here as the current state, not a code defect. Queue draining
  requires no separate worker process; the cron entry is the deployment item.

---

### TAM-008 — `SESSION_SECURE_COOKIE` missing from `.env.example`

- **ID:** TAM-008
- **Title:** `SESSION_SECURE_COOKIE=true` not in `.env.example`
- **Category:** Configuration
- **Severity:** P2
- **Verification:** CONFIRMED
- **Status:** RESOLVED (2026-08-01)
- **Confidence:** High
- **Area:** `.env.example` / session configuration
- **Evidence:** Historical report: `docs/TASK.md` Deployment Pending asked to add
  `SESSION_SECURE_COOKIE=true` to `.env.example` so it is not forgotten on the
  next environment setup. Current status: `.env.example` line 35 now contains
  `SESSION_SECURE_COOKIE=true` (verified 2026-08-01). The CI workflow still
  overrides it to `false` for local HTTP test runs (`.github/workflows/ci.yml`),
  which is intentional for tests.
- **Impact:** Resolved for fresh environments. Remaining action is operational, not
  a code/doc gap: confirm `SESSION_SECURE_COOKIE=true` on the production `.env`
  during the deploy run (tracked under TAM-006).
- **Production blocking:** No (must be confirmed manually before launch).
- **Recommended direction:** None for the repository; verify `true` on production.
- **Verification source:** `docs/TASK.md`, `.github/workflows/ci.yml`, `.env.example`.
- **Notes:** Superseded by the deploy checklist (TAM-006) for the production
  verification half.

---

### TAM-009 — `VideoProxyService` disables SSL verification

- **ID:** TAM-009
- **Title:** SSL verification disabled on video proxy stream contexts
- **Category:** Security
- **Severity:** P3
- **Verification:** CONFIRMED (historical); SUPERSEDED by current implementation
- **Status:** RESOLVED (Batch 1, 2026-08-01)
- **Confidence:** High
- **Area:** `VideoProxyService`
- **Evidence:** Historical report: all three `stream_context_create` blocks
  (`fetchHead`, `handleRangeRequest`, `handleFullRequest`) disabled SSL
  verification with a documented rationale comment, per `docs/TASK.md` and
  `quality-report.md`. Current status: Batch 1 rewrote `fetchHead()` as a manual
  redirect loop and added `createStreamContext()` with `follow_location=0`/
  `max_redirects=0` plus `verify_peer=true`/`verify_peer_name=true` for the
  range/full requests; the old SSL-disabled rationale comments were removed.
  TLS certificate and peer verification are now enabled (verified in
  `app/Services/VideoProxyService.php` `createStreamContext()`).
- **Impact:** Resolved — a MITM between the server and the video source is now
  detected via CA-chain and hostname verification. Low-risk for public streaming
  sources remains the norm, but verification is no longer disabled.
- **Production blocking:** No.
- **Recommended direction:** None — TLS verification is enabled.
- **Verification source:** `app/Services/VideoProxyService.php`, `docs/TASK.md`,
  `quality-report.md`.
- **Notes:** Previously tracked as WONT_FIX when verification was a deliberate
  disabled choice; the Batch 1 proxy rewrite superseded that decision.

## RESOLVED

### TAM-010 — Pre-existing a11y failure: auth "Verify email" registration redirect timeout

- **ID:** TAM-010
- **Title:** `auth-a11y.spec.ts` "Verify email page" fails — registration flow never reaches `waitForURL(/verify-email|dashboard/, { timeout: 10000 })`
- **Category:** Testing / Accessibility
- **Severity:** P3
- **Verification:** CONFIRMED (reproduced on 2026-08-08)
- **Status:** RESOLVED (2026-08-08)
- **Confidence:** High
- **Area:** `tests/a11y/auth-a11y.spec.ts` (registration flow → verification prompt), `tests/a11y/playwright.config.ts`, `tests/e2e/playwright.config.ts`, `routes/test-helpers.php`, `resources/js/Components/ui/inertia-progress.tsx`
- **Evidence:** During the 2026-08-08 UI-primitives batch (STEP 3c palette/fonts work), the full a11y suite ran **10/11** — every test except "Verify email page" passes. The failure was a `waitForURL(/verify-email|dashboard/, { timeout: 10000 })` timeout during the registration flow; the redirect never landed. It was **pre-existing** — reproduced on a clean checkout with none of the batch's changes.
  **Root cause:** the Playwright `webServer` boots `php artisan serve` against the local `.env` where `MAIL_MAILER=resend` with a real key. Registration fires the `Registered` event → `User::sendEmailVerificationNotification()` → the `VerifyEmail` notification (extends the framework base, not `ShouldQueue`) sends synchronously → Resend rejects `@example.com` test addresses (`Invalid "to" field…`, `ResendTransport.php:118`) → `TransportException` → **500 on POST /register** → redirect never happens → timeout. `phpunit.xml` already sets `MAIL_MAILER=array` (PHPUnit never hit Resend); there is no `.env.testing`; the culprit was only the Playwright boot.
  **Fix (test-server scoped; local/production `.env` untouched):** `MAIL_MAILER: "array"` added to `webServer.env` in both `tests/a11y/playwright.config.ts` and `tests/e2e/playwright.config.ts`. Because `Notification::fake()`/`Mail::fake()` are PHPUnit-only, the browser test reads the real signed URL via a new test-only route `GET /__test/verification-url?email=…` in `routes/test-helpers.php` (returns `URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), ['id' => $user->id, 'hash' => sha1($user->getEmailForVerification())])`). The spec then `page.goto()`s that URL and asserts it lands on the verified-only `/dashboard` (verification proof). Note the redirect resolves via the session `intended` URL (`/dashboard`) because the unverified-dashboard redirect stored it, so the `?verified=1` fallback is not asserted.
  **Surfaced a real product defect:** once the registration flow succeeded, axe flagged Inertia's bundled NProgress markup `<div class="bar" role="bar">` — `role="bar"` is not a valid ARIA role (critical). Fixed by disabling the default (`progress: false` in `resources/js/app.tsx`) and rendering a custom `Components/ui/inertia-progress.tsx` — a thin `role="progressbar"` with `aria-valuemin/max/now` driven by `router.on('start'|'progress'|'finish')`, styled with `bg-primary`.
  **Verification:** `-g "Verify email" --repeat-each=5` → 5/5; full a11y suite **11/11**; full E2E suite **22/22** (one transient 2.1 sync-error-banner flake on the first run, green on re-run); `php artisan test` 262/262; Vitest 231/231; lint / type-check / Pint / Prettier clean.
- **Impact:** Resolved — the full a11y suite is green (11/11) and the app's top navigation progress bar now carries a valid `progressbar` role instead of the invalid `bar` role.
- **Production blocking:** No.
- **Recommended direction:** None — resolved. If the E2E `2.1` sync-error-banner flake recurs, treat it as the documented single-worker load flake, not a regression.
- **Verification source:** `npm run test:a11y` runs 2026-08-08 (11/11 after fix; 10/11 before); `tests/a11y/auth-a11y.spec.ts`; `tests/a11y/playwright.config.ts`; `tests/e2e/playwright.config.ts`; `routes/test-helpers.php`; `resources/js/Components/ui/inertia-progress.tsx`; `resources/js/app.tsx`.
- **Notes:** Tracked deliberately so the batch did not get blamed for it, and so it was not silently "fixed" inside an unrelated commit — it is fixed in its own unit of work. The `register` rate limiter (`perMinute(5)->by(ip)`, `app/Providers/AppServiceProvider.php`) persists in the database cache; repeated registration tests within the same minute trip a 429 — clear the throttle key between runs (`php artisan cache:forget throttle:register:127.0.0.1`) or let the window elapse.

---

### TAM-011 — Room.spec fake-URL revert race under Pusher transport

- **ID:** TAM-011
- **Title:** `tests/e2e/room.spec.ts` "Playback state propagates" fails under Pusher push transport
- **Category:** Testing / E2E
- **Severity:** P3
- **Verification:** CONFIRMED (reproduced 2026-08-12)
- **Status:** RESOLVED (2026-08-12, commit `7bb146e`)
- **Confidence:** High
- **Area:** `tests/e2e/room.spec.ts`, `routes/test-helpers.php`
- **Evidence:** The test set an unplayable fake URL (`https://www.example.com/video.mp4`) via `set-video`, then PATCHed `is_playing:true`. Under Pusher push transport with a running queue worker, the broadcast reached the host page whose player failed to load the fake URL and fired native `pause`, causing `SyncedVideoJsPlayer.handlePause` to PATCH `is_playing:false` back (reverting state) before the guest polled.
- **Fix:** Switched test to use `?local_video=1` real same-origin fixture (`sample.mp4`, direct mode) and returned `video_url` in `setup-verified-room` helper response.
- **Impact:** Resolved — full E2E suite 22/22 green under Pusher mode.
- **Production blocking:** No.
- **Verification source:** Commit `7bb146e`, `docs/TASK.md`.

---

### TAM-012 — CI clipboard permission gap in headless Chromium

- **ID:** TAM-012
- **Title:** Toast copy-link test times out in CI headless Chromium
- **Category:** Testing / Environment
- **Severity:** P3
- **Verification:** CONFIRMED (reproduced 2026-08-11)
- **Status:** RESOLVED (2026-08-11, commit `86784c5`)
- **Confidence:** High
- **Area:** `tests/a11y/playwright.config.ts`
- **Evidence:** Bundled headless Chromium in CI does not auto-grant `clipboard-read`/`clipboard-write` permissions, causing `safeCopyToClipboard` to reject and show error toast instead of success toast (`لینک دعوت کپی شد.`).
- **Fix:** Added `permissions: ["clipboard-read", "clipboard-write"]` to `tests/a11y/playwright.config.ts`.
- **Impact:** Resolved — toast copy-link test passes reliably in CI.
- **Production blocking:** No.
- **Verification source:** Commit `86784c5`, `docs/TASK.md`.

---

### TAM-013 — CI wall-clock timeout for 8-scan contrast dialogs test

- **ID:** TAM-013
- **Title:** `contrast-a11y.spec.ts` dialogs test times out at default 30s budget on single-core CI
- **Category:** Testing / Performance
- **Severity:** P3
- **Verification:** CONFIRMED (reproduced 2026-08-11)
- **Status:** RESOLVED (2026-08-11, commit `86784c5`)
- **Confidence:** High
- **Area:** `tests/a11y/contrast-a11y.spec.ts`
- **Evidence:** The test executes 8 full-page axe color-contrast scans across 4 dialog states × 2 themes plus room setups. Single-core CI runner CPU constraint pushed cumulative runtime past 30s.
- **Fix:** Added scoped `test.setTimeout(60_000)` to `contrast-a11y.spec.ts` for the dialogs test.
- **Impact:** Resolved — full a11y suite 19/19 green in CI.
- **Production blocking:** No.
- **Verification source:** Commit `86784c5`, `docs/TASK.md`.

---

### TAM-014 — Stale-session-cookie overwrite race in CI room navigation

- **ID:** TAM-014
- **Title:** Room navigation tests intermittently 302 to `/login` in CI
- **Category:** Testing / Authentication
- **Severity:** P3
- **Verification:** CONFIRMED (reproduced 2026-08-12)
- **Status:** RESOLVED (2026-08-12, commit `b5cde1a`)
- **Confidence:** High
- **Area:** `tests/a11y/room-nav.ts`, `tests/a11y/contrast-a11y.spec.ts`, `tests/a11y/room-a11y.spec.ts`
- **Evidence:** `Auth::login()` in room setup route regenerates session ID. In-flight room-page polls carrying pre-regeneration ID resurrect stale ID as empty guest session, sending a `Set-Cookie` header that overwrites browser's fresh authenticated session cookie.
- **Fix:** Created `tests/a11y/room-nav.ts` with race-safe `gotoRoom()` helper that detects redirect to `/login` and re-runs setup once to establish clean authenticated session.
- **Impact:** Resolved — all room navigation tests pass deterministically (a11y 19/19).
- **Production blocking:** No.
- **Verification source:** Commit `b5cde1a`, `docs/TASK.md`.

---

### TAM-015 — System proxy (Happ/Xray) breaks Chrome↔Herd HTTPS connections

- **ID:** TAM-015
- **Title:** Chrome gets `ERR_CONNECTION_CLOSED` on every `https://tamasharoom.test` URL while Node/curl succeed
- **Category:** Testing / Environment
- **Severity:** P3
- **Verification:** CONFIRMED (diagnosed and fixed 2026-08-17)
- **Status:** RESOLVED (2026-08-17)
- **Confidence:** High
- **Area:** Windows system proxy settings (`HKCU\...\Internet Settings`), Playwright browser launch
- **Evidence:** The E2E soak test (`playback-long-running.spec.ts`) failed with `ERR_CONNECTION_CLOSED` navigating to `https://tamasharoom.test/rooms/{id}`, while the config's `resolveBaseUrl()` probe (Node) and plain `fetch` got 200 on the same URLs — even `/login` failed in Chrome but not Node. Root cause: the machine has a **system proxy enabled** (`ProxyEnable=1`, `ProxyServer=127.0.0.1:10809`) installed by the **Happ app (FlyFrogLLC)**, which bundles an Xray proxy (`C:\Program Files\FlyFrogLLC\Happ\core\xray.exe`). Chrome honors the Windows system proxy (WinINET); Node/curl do not unless env vars are set. `tamasharoom.test` was **not** in `ProxyOverride`, so Chrome tunneled `.test` traffic through Xray, whose remote routing cannot reach the local Herd site → connection closed. Reproduced directly: `curl -x http://127.0.0.1:10809 https://tamasharoom.test/login` → "200 Connection established" then TLS handshake fails, exactly matching Chrome's error. `--no-proxy-server` and `--disable-http2` did not help (WinINET proxy takes precedence). Herd itself was healthy throughout (nginx workers up, cert valid to 2027-08-09, HTTP/1.1 200 via curl).
- **Fix:** Added `tamasharoom.test;*.test` to the WinINET `ProxyOverride` bypass list (system setting, not a repo change). Chrome then loads `https://tamasharoom.test/login` with status 200.
- **Impact:** Resolved — Chrome/Playwright can reach the Herd base URL again; the soak test's real blocker was this proxy, not the test or Herd.
- **Production blocking:** No.
- **Recommended direction:** None beyond the bypass entry. If the Happ/Xray proxy is toggled off/on or reinstalled, verify `tamasharoom.test` (or `*.test`) remains in `ProxyOverride`. Note: this is separate from and compatible with the soak-test base-URL decision (see `docs/TASK.md` 2026-08-17 note — the soak must stay on Herd; the PHP built-in server cannot sustain long proxy streaming).
- **Verification source:** Live reproduction 2026-08-17 (Playwright Chromium vs. `curl -x` through the proxy); registry read/update of `HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings`; successful Chrome load of `https://tamasharoom.test/login` (200) after the fix.

---

### TAM-100 — "SRT uploads rejected" (originally reported as a proxy failure)

- **ID:** TAM-100
- **Title:** SRT uploads failed with MIME validation error
- **Category:** Security / Uploads
- **Severity:** n/a
- **Verification:** CONFIRMED (originally reported as a proxy failure — a
  FALSE_POSITIVE diagnosis; the true cause was the MIME rule)
- **Status:** RESOLVED
- **Confidence:** High
- **Area:** `UploadSubtitleRequest`
- **Evidence:** The original symptom appeared as a proxy/502 error, but the true
  cause was `mimes:srt,vtt` using Symfony `guessExtension()` on file content
  (SRT content guesses as `txt`). Fixed by changing the rule to
  `mimes:srt,vtt,txt`; the `after()` hook still validates real SRT/VTT format.
  [Confirmed — `docs/TASK.md` E2E CSRF fix & SRT MIME validation section]
- **Impact:** Resolved.
- **Verification source:** `docs/TASK.md`.
- **Notes:** An `mimetypes:text/plain,...` alternative was tried and rejected
  because it broke fake `UploadedFile` unit tests (422); the chosen rule works for
  both real browser uploads and fakes.

### TAM-101 — `is_owner` missing from member API (reported during E2E debugging)

- **ID:** TAM-101
- **Title:** `is_owner` field absent from RoomMember serialization
- **Category:** Contract
- **Severity:** n/a
- **Verification:** CONFIRMED
- **Status:** RESOLVED
- **Confidence:** High
- **Area:** `RoomMember` model, `RoomController::members()`
- **Evidence:** The field was documented in `FRONTEND_CONTRACT.md` for
  `PresenceMember` but was missing from `RoomMember`. Fixed by adding
  `$appends = ['is_owner']` + an accessor, and setting the `room` relation on each
  loaded member to avoid an N+1. [Confirmed — `docs/TASK.md`]
- **Impact:** Resolved; E2E 12/12 now pass.
- **Verification source:** `docs/TASK.md`.
- **Notes:** This was a docs-vs-reality gap, caught by the verification loop.

### TAM-200 — Exact a11y suite passing count (reported 8/8)

- **ID:** TAM-200
- **Title:** Exact a11y suite passing count (reported 8/8)
- **Category:** Testing / Accessibility
- **Severity:** n/a
- **Verification:** RESOLVED
- **Status:** RESOLVED (2026-08-01)
- **Confidence:** High
- **Area:** Frontend a11y test suite
- **Evidence:** Historical report: the a11y suite passing count was referenced as
  8/8 in working-session history; `docs/TASK.md` did not then state a passing
  count. Current status (verified 2026-08-12): the full a11y suite is **19/19**
  passing across 5 spec files (`a11y`, `auth-a11y`, `contrast-a11y`, `room-a11y`,
  `welcome-a11y`).
- **Impact:** Resolved — the suite count is now verified directly.
- **Production blocking:** No.
- **Recommended direction:** None — count verified by test run on 2026-08-12.
- **Verification source:** test run 2026-08-12, `tests/a11y/*.spec.ts`.
- **Notes:** Historical progression: 8/8 → 11/11 (Batch 2D) → 19/19 (Contrast & Auth pass).

---

## UNVERIFIED

> Items that have been reported but not yet confirmed or refuted against the
> source. They are **not** treated as issues until verified.

| ID | Title | Verification | Status | Why unverified | Source |
|---|---|---|---|---|---|
| TAM-201 | Production hosting details (provider, PHP selector, domain config) | UNVERIFIED | OPEN | Not present in the repository | — |
| TAM-202 | Current `node_modules`/`vendor` sizes vs. quality-report.md (622MB/833 pkgs) | UNVERIFIED | OPEN | Not re-checked in this pass | quality-report.md |
| TAM-203 | DESIGN.md design-system details | UNVERIFIED | OPEN | Referenced from PRODUCT.md as bare "DESIGN.md"; no such file exists at root or in `docs/`. The authoritative design-system doc is `design-systems/tamasharoom/DESIGN.md` (draft) — path confirmed 2026-08-02, content not reviewed | PRODUCT.md, `design-systems/tamasharoom/DESIGN.md` |

---

## Recommended Fix Order

Order by severity × verification confidence × production impact:

1. **TAM-006 (P0, deploy blocker)** — Run the deployment checklist end-to-end
   before any launch. This is the only item that blocks going live.
2. **TAM-001 (P2, WONT_FIX for MVP)** — Keep tracked; implement the stream-context
   IP check when time allows or pre-VPS migration.
3. **Resolved in prior batches** — TAM-002 (migration count, Batch 2A),
    TAM-003 (subtitle sanitization test, Batch 2B), TAM-005 (ownership transfer
    UX, Batch 2C), TAM-004 (a11y coverage, Batch 2D), TAM-008 (SESSION_SECURE_COOKIE
    in .env.example), TAM-009 (TLS verification enabled, Batch 1), TAM-010 (a11y
    "Verify email" registration flow + invalid `role="bar"` progress markup),
    TAM-011 (fake-URL revert race), TAM-012 (CI clipboard permission), TAM-013 (CI contrast timeout),
    TAM-014 (CI stale-session cookie race), TAM-015 (Happ/Xray system proxy breaking Chrome↔Herd), TAM-200 (a11y count verified).
