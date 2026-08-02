# Prompt: Desktop AI — Comprehensive Read-Only Audit

> Use this prompt to ask the Desktop AI to audit the actual local repository.
> It is a **read-only** audit: the Desktop AI must never modify anything.

---

## Prompt Template

```
You are the Desktop AI performing a comprehensive READ-ONLY audit of the
TamashaRoom local repository at: <PATH TO LOCAL REPOSITORY>.

## Hard rules

- STRICTLY READ-ONLY. You must NOT modify, create, or delete any file or
  directory — including documentation. You must NOT run any command that changes
  state (no migrations, no seeders, no installs, no builds that write output,
  no formatters, no code generation, no cache-writing commands, no git
  operations that write).
- Command safety: you may only run a command that is KNOWN to be read-only in
  this project/environment and does not generate, modify, cache, compile, or
  otherwise change project state. If uncertain whether a command writes
  anything, DO NOT RUN IT. Prefer inspection over execution.
- You MAY read files, list directories, and run read-only inspection commands
  (e.g. `git status`, `git log`, listing, grep/ripgrep, `php -l` if lint-only,
  `tsc --noEmit` if it does not write a build artifact).
- If a command would modify state, do not run it; note it as a manual step
  for the human instead.
- You never update ISSUE_REGISTER.md or any documentation. Your deliverable is a
  report; the human / Web AI updates the docs after reviewing it.

## Context to read first

- docs/PROJECT.md, docs/TASK.md, docs/SYSTEM.md, docs/deployment-checklist.md,
  FRONTEND_CONTRACT.md, AGENTS.md
- .opencode/skills/ (the project's coding rules)

## What to audit

1. <AREA 1 — e.g. "Playback synchronization": verify the polling flow, the
   PlaybackStateChanged event, the state_version optimistic concurrency, and
   the drift-compensation logic against the real source.>
2. <AREA 2 — e.g. "Security": SSRF protection in UrlSecurityService, subtitle
   upload validation, security headers, rate limiting, CSRF handling.>
3. <AREA 3 — e.g. "Authorization": every protected controller method calls
   $this->authorize(); policies are correct; 404-not-403 behavior.>
4. <AREA N — add as many as needed>

## Deliverable

Return a structured audit report with, per finding:

- **Claim** — what you found
- **Evidence** — file:line and a short quote, or the read-only command output
- **Verdict** — CONFIRMED / LIKELY / UNVERIFIED / FALSE_POSITIVE / NOT AN ISSUE
- **Severity** — P0 (production blocker) / P1 (critical) / P2 (important) /
  P3 (minor)- **Impact** — what breaks, or none
- **Recommended direction** — next step, if any

Also include:

- A summary of test files and whether they can be run from this environment
- Any file inventory that is relevant (pages, components, controllers, models,
  routes, migrations)
- Any documentation-vs-code mismatches you noticed
- Anything the previous audit/report may have missed (identify missed issues)

Do NOT fix anything. Report only.
```

---

### Notes for the operator

- Replace `<PATH TO LOCAL REPOSITORY>` and the area placeholders before sending.
- The Desktop AI returns a report only; it never writes files. The **operator**
  saves the returned report to `docs/ai/audits/` and mirrors confirmed findings
  into `docs/ai/ISSUE_REGISTER.md`.
- Do not paste the full prompt content into the repo — the template lives here.
