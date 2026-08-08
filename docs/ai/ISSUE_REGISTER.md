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
  a11y suite is 11/11 passing.
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

---

### TAM-010 — Pre-existing a11y failure: auth "Verify email" registration redirect timeout

- **ID:** TAM-010
- **Title:** `auth-a11y.spec.ts` "Verify email page" fails — registration flow never reaches `waitForURL(/verify-email|dashboard/, { timeout: 10000 })`
- **Category:** Testing / Accessibility
- **Severity:** P3
- **Verification:** CONFIRMED (reproduced on 2026-08-08)
- **Status:** OPEN
- **Confidence:** High
- **Area:** `tests/a11y/auth-a11y.spec.ts` (registration flow → verification prompt)
- **Evidence:** During the 2026-08-08 UI-primitives batch (STEP 3c palette/fonts work), the full a11y suite ran **10/11** — every test except "Verify email page" passes. The failure is a `waitForURL(/verify-email|dashboard/, { timeout: 10000 })` timeout during the registration flow; the redirect never lands. It is **pre-existing** — it reproduces on a clean checkout with none of the batch's changes (frontend-only emoji/toast/palette; auth code untouched), and it was failing before this batch's work. The batch's own welcome a11y contrast regression (invite-code chip 4.11:1) was fixed and now passes; TAM-010 is unrelated.
- **Impact:** One a11y spec fails; the rest of the suite (welcome, login, register, dashboard, forgot-password, profile, reset-password, confirm-password, profile delete-account modal, room) passes. Not a production blocker; the verify-email **page** itself has no axe violation when reached directly — the failure is in the registration **flow** reaching it.
- **Production blocking:** No.
- **Recommended direction:** Investigate the registration redirect separately (possibly an auth/verification-environment dependency such as the Resend mailer in test runs, or a redirect target/timeout mismatch). Fix in its own unit of work — explicitly **not** part of the 2026-08-08 UI-primitives batch.
- **Verification source:** `npm run test:a11y` run 2026-08-08 (10/11; only "Verify email page" failed); `tests/a11y/auth-a11y.spec.ts`.
- **Notes:** Tracked deliberately so the batch does not get blamed for it, and so it is not silently "fixed" inside an unrelated commit. See `docs/TASK.md` "UI primitives batch" (2026-08-08) for the batch verification numbers.

---

## RESOLVED

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
  count. Current status (verified 2026-08-01): the full a11y suite is 11/11
  passing — welcome, login, register, dashboard, forgot-password, verify-email,
  profile, reset-password, confirm-password, profile delete-account modal, and
  room. The increase reflects the axe coverage added for
  `/reset-password/{token}`, `/confirm-password`, and the Profile delete-account
  modal open state (Batch 2D, TAM-004).
- **Impact:** Resolved — the suite count is now verified directly.
- **Production blocking:** No.
- **Recommended direction:** None — count verified by test run on 2026-08-01.
- **Verification source:** test run 2026-08-01, `tests/a11y/auth-a11y.spec.ts`.
- **Notes:** The historical 8/8 figure is superseded by the current 11/11 count,
  not contradictory with it — the three extra pages were added in Batch 2D.

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
   in .env.example), TAM-009 (TLS verification enabled, Batch 1), TAM-200 (a11y
   count verified).
