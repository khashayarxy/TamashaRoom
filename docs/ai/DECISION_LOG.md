# DECISION_LOG.md

> Lightweight Architecture Decision Log for TamashaRoom. Records important
> decisions that are actually supported by project materials. Decisions without a
> documented historical date or rationale are marked as such — nothing is
> invented here.

---

## DECISION-001 — Laravel + Inertia + React architecture

- **ID:** DECISION-001
- **Title:** Replace Next.js App Router with Laravel 13 + Inertia.js 2 + React 19
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** The deployment target is shared cPanel hosting (Apache, PHP 8.4,
  MySQL, 2GB RAM, 1 CPU core, 20GB storage) with no Node.js runtime, no Docker,
  no Redis, no WebSockets, no persistent background workers, and no root access.
  The previous stack assumed the Next.js App Router / serverless model, which this
  hosting cannot support.
- **Decision:** PHP 8.4 + Laravel + Inertia.js + React 19 + Vite, with Node.js 22
  used only as a build-time tool. Controllers own data; React pages render
  Inertia props.
- **Reason:** Laravel is the most maintainable, best-documented option for this
  exact hosting profile — Composer-based deployment, migrations against MySQL,
  mature ecosystem, and a PHP-FPM request model that fits a single CPU core far
  better than a persistent Node.js server competing for 2GB RAM. Inertia provides
  the App Router's server-owned-data ergonomics without a Node runtime.
- **Consequences:** No separate REST layer for the app's own UI; every navigation
  is a real HTTP request; the frontend is still React + Tailwind + TypeScript;
  the migration to the new stack touched SYSTEM.md chapters 16–29 and PROJECT.md.
- **Alternatives considered:** Next.js App Router (rejected — hosting cannot run
  it); a pure Blade/PHP frontend (not considered per available materials).
- **Source:** docs/PROJECT.md "Current Status" (2026-07-20 entry), docs/SYSTEM.md
  ch. 18.00.

---

## DECISION-002 — Polling instead of persistent WebSockets

- **ID:** DECISION-002
- **Title:** Playback sync delivered by client polling, not WebSockets
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog; historical reasoning
  before this date not documented)
- **Status:** ACCEPTED (implemented)
- **Context:** Playback sync is the product's core mechanic and normally requires
  WebSockets. The MVP's shared cPanel hosting cannot run a WebSocket server, and
  cPanel cannot keep a long-lived process alive outside PHP-FPM's request
  lifecycle.
- **Decision:** Playback state changes are written as a Laravel broadcastable
  Event (`PlaybackStateChanged`); the frontend polls for state every 3 seconds
  (adjustable post-MVP) instead of receiving pushes.
- **Reason:** Polling is the only transport available within the hosting budget.
  State changes are still written through the Event so the transport remains
  swappable (see DECISION-003).
- **Consequences:** Roughly 1–2 seconds of sync drift between members — acceptable
  for the test/MVP phase, not frame-accurate. Polling intervals are kept in
  seconds and only while relevant UI is visible, to protect the single CPU core.
- **Alternatives considered:** WebSockets (rejected — hosting constraint);
  direct model polling (rejected — see DECISION-003).
- **Source:** docs/PROJECT.md "Real-Time Architecture", docs/SYSTEM.md ch. 18.05.

---

## DECISION-003 — Room-state reads always go through the Event (transport-agnostic)

- **ID:** DECISION-003
- **Title:** Never build room-state features against direct polling of a model
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** To keep the future WebSocket migration a driver swap rather than a
  feature rewrite, the read path and write path must both be transport-agnostic.
- **Decision:** Every room-state change is written as a broadcastable Event; the
  frontend polls for it today and will receive pushes later via Laravel Echo. No
  component reads room state by directly polling a model.
- **Reason:** A `BROADCAST_CONNECTION` config change plus Reverb install must be
  sufficient to move to real-time — no feature rewrite.
- **Consequences:** The `usePlaybackSync` hook hides the transport; the migration
  is a hook rewrite plus config change. Frontend components do not change.
- **Alternatives considered:** Direct model polling (rejected — would require a
  rewrite to go real-time later).
- **Source:** docs/PROJECT.md "Real-Time Architecture", AGENTS.md, docs/SYSTEM.md
  ch. 18.05 Rule 3.

---

## DECISION-004 — External video hosting, not storing files

- **ID:** DECISION-004
- **Title:** Support external video links only; store no video files
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog — the product definition)
- **Status:** ACCEPTED (implemented)
- **Context:** TamashaRoom is a watch-party platform for Persian users. Storing or
  hosting video files would require substantial storage (20GB budget) and legal/
  content handling.
- **Decision:** Rooms use an external video URL as the source. No video files are
  stored on the server; only playback state, chat, subtitles, and membership are.
- **Reason:** Fits the 20GB storage budget; keeps the platform a synchronization
  layer rather than a content host.
- **Consequences:** Playback depends on external sources being reachable; hence
  the direct-vs-proxy playback mode decision (DECISION-005) and the SSRF
  validation boundary.
- **Alternatives considered:** File uploads/hosting (rejected — storage and
  content implications not supported by MVP materials).
- **Source:** docs/PROJECT.md "Core Concept", docs/TASK.md.

---

## DECISION-005 — Direct-vs-proxy video playback mode

- **ID:** DECISION-005
- **Title:** Auto-detect playback mode: direct client playback or server proxy
- **Date:** 2026-07-21 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** External video sources vary in CORS and range-request support.
  Proxying every video through a 1-CPU-core server is expensive; direct playback
  is not always possible.
- **Decision:** `DetermineVideoPlaybackModeAction` performs an SSRF-safe HEAD
  check. If the source supports CORS `*` + `Accept-Ranges: bytes`, playback mode
  is `direct` (the `<video>` loads it directly). Otherwise it is `proxy` (server
  streams it). The mode is stored on the room row as a `PlaybackMode` backed enum.
- **Reason:** Balance single-core CPU budget against source compatibility;
  delegate bandwidth to the client whenever possible.
- **Consequences:** `VideoProxyService` handles range requests, MIME mapping, and
  rate limiting; SSRF validation protects the proxy path.
- **Alternatives considered:** Always-proxy (rejected — CPU/bandwidth cost);
  always-direct (rejected — incompatible sources would break).
- **Source:** docs/TASK.md "Launch Blockers", FRONTEND_CONTRACT.md §7.1.

---

## DECISION-006 — Shared-hosting compatibility as a hard constraint

- **ID:** DECISION-006
- **Title:** Design within the shared-hosting budget (no Docker/Redis/WebSockets/workers)
- **Date:** 2026-07-20 (re-architecture date); principle stated in AGENTS.md
- **Status:** ACCEPTED (enforced)
- **Context:** The deployment target is shared cPanel hosting with 2GB RAM, 1 CPU
  core, 20GB storage and no root access.
- **Decision:** No feature may assume Docker, Redis, WebSockets, a persistent
  background worker, or horizontal scaling as a fallback. Cache, session, and
  queue use database drivers; background work runs on a scheduled basis via the
  single cron entry.
- **Reason:** The hosting cannot provide these; assuming them guarantees a broken
  production deploy.
- **Consequences:** Polling-based sync, database cache/session/queue, one cron
  entry running `schedule:run`, no sub-minute background processing assumptions.
- **Alternatives considered:** VPS hosting (deferred — MVP phase targets shared
  hosting; migration path is planned).
- **Source:** AGENTS.md, docs/PROJECT.md, docs/SYSTEM.md ch. 18.

---

## DECISION-007 — Private room model with invite links

- **ID:** DECISION-007
- **Title:** Rooms are private, joined via 12-char invite codes
- **Date:** 2026-07-20 (from docs/PROJECT.md changelog — product definition)
- **Status:** ACCEPTED (implemented)
- **Context:** The product is for friends/family watching together; rooms are not
  meant to be publicly discoverable.
- **Decision:** A user creates a room and receives a 12-char random invite code;
  anyone with the link joins. Room lock prevents new joins; owner can regenerate
  the invite code.
- **Reason:** Matches the private, social use case; no public discovery needed for
  MVP.
- **Consequences:** Join route rate-limited (10/min); room membership is
  authorization-gated; owner controls who is in the room (kick, lock).
- **Alternatives considered:** Public rooms with discovery (deferred — not in MVP).
- **Source:** docs/PROJECT.md "Core Concept", FRONTEND_CONTRACT.md.

---

## DECISION-008 — Sanctum for external API consumers

- **ID:** DECISION-008
- **Title:** Sanctum token auth for routes/api.php
- **Date:** 2026-07-22 (from docs/TASK.md)
- **Status:** ACCEPTED (implemented)
- **Context:** External/mobile consumers need a token-based API separate from the
  session-based app UI.
- **Decision:** Install Laravel Sanctum, publish its config, run its migration;
  route Inertia pages through the session guard and API routes through Sanctum
  tokens.
- **Reason:** Laravel's standard, supported token auth for the API surface.
- **Consequences:** `personal_access_tokens` migration added; API rules in
  docs/SYSTEM.md ch. 18.08 apply (Form Requests, rate limits, typed resources).
- **Alternatives considered:** JWT packages / Passport (not supported by available
  materials).
- **Source:** docs/TASK.md (2026-07-22 entry), config/migrations listing.

---

## DECISION-009 — Sentry for error monitoring

- **ID:** DECISION-009
- **Title:** Sentry error monitoring, disabled when no DSN
- **Date:** 2026-07-21 (from docs/PROJECT.md changelog)
- **Status:** ACCEPTED (implemented)
- **Context:** Production errors must be observable on shared hosting without
  infrastructure complexity.
- **Decision:** Install `sentry/sentry-laravel`, publish `config/sentry.php`, add
  a `SENTRY_DSN` placeholder to `.env.example`; disabled when DSN is empty.
- **Reason:** Hosted error monitoring that requires no extra server infrastructure.
- **Consequences:** Error reporting available in production; nothing sent when the
  DSN is unset.
- **Alternatives considered:** Self-hosted monitoring (rejected — hosting
  constraint).
- **Source:** docs/PROJECT.md "Current Status", docs/TASK.md.

---

## DECISION-010 — Room ownership determined by comparison, no role column

- **ID:** DECISION-010
- **Title:** Ownership = user_id equals room.user_id; no `role` field
- **Date:** 2026-07-20 (implementation period; exact date not separately recorded)
- **Status:** ACCEPTED (implemented)
- **Context:** Distinguish owner from members without adding a role enum.
- **Decision:** There is no `role` column. Ownership is computed by comparing
  `RoomMember.user_id` to `Room.user_id`; exposed to the frontend as an
  `is_owner` boolean.
- **Reason:** Single source of truth for ownership; no denormalized role to keep
  in sync (especially important across ownership transfer).
- **Consequences:** `is_owner` appended on `RoomMember` serialization; any place
  needing ownership must compare against `room.user_id`.
- **Alternatives considered:** A role/permissions column (not supported by
  materials; rejected in favor of comparison).
- **Source:** FRONTEND_CONTRACT.md §3.3, app/Models/RoomMember.php.

---

## Decision Log Maintenance

New decisions get a new ID in sequence. Only decisions actually supported by
project materials (source code, docs, or verified test results) should be added.
If historical reasoning is unknown, say so explicitly rather than inventing it —
as done above for DECISION-002.
