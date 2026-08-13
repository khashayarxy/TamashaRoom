---
name: error-handling-rules
description: Error handling rules for TamashaRoom — error categories, error boundaries, API/form error handling, logging, and user-facing error messages. Use when adding try/catch logic, error boundaries, API error responses, or any user-facing failure state.
---

# Error Handling Rules

Full detail: `docs/SYSTEM.md`, Chapter 24 (Error Handling).

Error handling is a UX strategy, not just try/catch. A well-handled error
feels like a feature; a poorly handled one feels like a bug.

## Principles

- **Expected errors** (validation failures, "room is full," "invite code
  invalid") get graceful, specific, in-context UI feedback — never a generic
  toast with no actionable detail.
- **Unexpected errors** (uncaught exceptions, network failures) are caught by
  error boundaries with a real fallback UI, not a blank screen.
- `resources/views/errors/404.blade.php` and `500.blade.php` must exist and
  visually match the rest of the app — these are rendered by Laravel
  directly, not by Inertia, so they need their own styling.
- API errors are typed and predictable (see `security-rules` for the API
  Resource typing requirement).
- Form errors are field-specific and actionable — tell the user exactly what
  to fix, linked to the input via `aria-describedby` (see `accessibility-rules`).
- Error messages are written for humans, not stack traces — no raw exception
  text ever reaches the user in production.
- Every uncaught exception is captured by the exception handler's
  `reportable()` callback, not only the ones application code chooses to catch.
- Transient failures (network blips, a momentarily-slow query) get a retry
  mechanism where it makes sense — don't force the user to reload the page
  for something the client could quietly retry.

## Checklist (from SYSTEM.md 24.08)

- Expected errors have graceful UI feedback.
- Unexpected errors caught by error boundaries.
- `404.blade.php` / `500.blade.php` exist and match the app's visual language.
- Fatal errors have full-screen fallbacks.
- API errors typed and predictable; form errors field-specific and actionable.
- Error messages written for humans.
- Errors logged in both development and production; production errors monitored.
- `reportable()` callback captures every uncaught exception.
- Retry mechanisms exist for transient failures.
- Error states tested (unit and integration).
- Error UI is accessible (screen reader announcements, keyboard navigation).
