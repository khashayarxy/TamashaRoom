---
name: security-rules
description: Security rules for TamashaRoom — API boundary rules, authentication/authorization, SSRF protection, file upload hardening, rate limiting, and security headers. Use for anything in routes/api.php, any auth/authorization logic, file uploads, external URL handling, or webhook endpoints.
---

# Security Rules

Full detail: `docs/SYSTEM.md`, Chapter 18.08-18.09 (API Boundary and Security
Rules, Authentication Boundary Rules). Also see `docs/TASK.md` "Security
Hardening" for what's already implemented in this codebase.

## Already Implemented in This Codebase

Don't re-solve these — extend the existing services/middleware instead:

- **SSRF protection**: `UrlSecurityService` — DNS resolution, private IP
  blocking (RFC 1918, loopback, link-local, CGNAT), localhost hostname
  blocking, DNS rebinding protection. Relevant any time a user-supplied URL
  (a video link) is fetched server-side.
- **File upload hardening**: MIME content verification in
  `UploadSubtitleRequest` via an `after()` validation hook — format detection
  (SRT: numeric first line, VTT: WEBVTT header), rejects renamed executables
  and script injection.
- **Security headers middleware**: CSP (restrictive), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
  (all disabled), HSTS (production only), `X-Powered-By`/`Server` removed.
- **Rate limiting**: named limiters in `AppServiceProvider` — login (5/min
  per email+IP), register (5/min per IP), forgot-password (5/min per email+IP),
  reset-password (5/min per IP), chat (30/min), playback (60/min), video proxy
  (30/min), presence (60/min), join (10/min); email-verification routes use
  inline `throttle:6,1`. Every auth POST route is throttled (Authentication
  Rate-Limit Hardening batch, 2026-08-02).
- **Info leakage**: production error handler returns a generic message for
  non-HTTP exceptions; debug info hidden when `APP_DEBUG=false`.

## API Boundary Rules (routes/api.php)

Everything here applies to anything reachable by someone other than
TamashaRoom's own UI — a mobile client, third-party integration, webhook
sender, or a script replaying a captured request. If a URL exists, something
you didn't write will eventually call it.

1. **Choose the route surface by who's calling.** TamashaRoom's own UI uses
   `routes/web.php` exclusively — Inertia page routes for initial data *plus*
   session-authenticated JSON polling/action endpoints (playback state, presence,
   chat, room actions) reached via the axios `api` client. Anything else (mobile
   client, third party, webhook) → Sanctum-authenticated route in
   `routes/api.php`.
2. **Every endpoint is a public network boundary.** Auth, authorization,
   input shape, and rate limits are enforced inside the controller/Form Request
   — never assumed from "only our app calls this." This holds for the
   `web.php` JSON endpoints just as much as for `api.php`.
3. **Validate all input.** Structured multi-field input goes through a Form
   Request (`authorize()` + `rules()`); simple single-field action endpoints may
   use inline `$request->validate()` (e.g. `ChatController::store`). Either way
   only validated data reaches Eloquent — never `$request->all()`.
4. **Authenticate then authorize, inside the controller, as the first two
   actions**:
   ```php
   public function destroy(Room $room): Response
   {
       $this->authorize('delete', $room); // Policy checks ownership
       $room->delete();
       return response()->noContent();
   }
   ```
   Authentication answers "is this a real caller." Authorization answers "is
   this specific caller allowed to do this to this specific resource." A
   Policy that only checks the first would let anyone delete any room.
5. **Rate limit every public endpoint** — anything reachable without an
   established session (login, registration, password reset, webhooks) —
   using `throttle` middleware backed by the database cache driver. Current
   state: login, register, forgot-password, reset-password, email
   verification, chat, playback, proxy, presence, and join are all throttled.
6. **Never expose internal errors.** `APP_DEBUG=false` in production without
   exception; the exception handler returns a generic message while logging
   the real error server-side. This is the single most consequential setting
   on shared hosting, where a leaked stack trace can reveal file paths other
   tenants share the server with.
7. **Type API responses end to end** with a Laravel API Resource, mirrored in
   a shared TypeScript type — an untyped response is a contract nobody agreed to.
8. **Verify webhooks before trusting them** — check the sender's signature
   against the raw request body before parsing it as data.

## Authentication & Authorization

- Session-based auth (Laravel's session guard) for the app's own UI, session
  driver `database` (no Redis). External/mobile consumers use Sanctum
  tokens, scoped per-token to exactly the abilities that client needs —
  never a single all-access token.
- **Middleware only checks "does a valid session/token exist."** It never
  checks resource-level permissions — it doesn't have enough context about
  which room/resource is being accessed.
- **Policies check "is this specific user allowed to do this specific thing
  to this specific resource,"** called explicitly with `$this->authorize(...)`
  inside every controller method that touches a resource — independent of
  which route or UI element reached it.
- **A resource the user isn't authorized to see returns 404, not 403.** A 403
  confirms the resource exists; 404 doesn't.

## Self-Review Questions

- If someone called this controller method directly, with a valid session
  but not a member of this room, what would stop them?
- Does middleware do anything here beyond "does a session exist"?
- Where exactly does a Policy confirm the current user has access to this
  specific room/resource?
- For an unauthorized resource, does the response look identical to "not found"?
- If this endpoint were hit 1000 times/second from one IP, what stops it
  from degrading the single shared CPU core for everyone else?
