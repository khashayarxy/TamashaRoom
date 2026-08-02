# VERIFY.md

> Reusable verification procedure for the Desktop AI. The Desktop AI is
> **strictly read-only**: it inspects the actual local codebase and returns a
> verification report. It never edits code, never creates or deletes files, and
> never updates documentation — including this directory and ISSUE_REGISTER.md.

---

## Purpose

The verification step is how a claim becomes a fact (or is rejected). It exists to
stop unverified findings from being treated as bugs, and to catch issues that a
web-based AI cannot see because it cannot access the source.

## The Division of Labor (important)

Desktop AI produces a **verification report** — nothing else.

```
Desktop AI
    ↓
Verification Report
    ↓
Web AI / Human Review
    ↓
Documentation Update (by Web AI / Human)
    ↓
ISSUE_REGISTER.md
```

Desktop AI never directly updates the Issue Register, PROJECT_BASELINE, or
DECISION_LOG. Those are updated by Web AI / the human after reviewing the report.
If a report contains verified findings, the operator (or Web AI) mirrors them into
ISSUE_REGISTER.md — not the Desktop AI.

## Standard Verdicts

Every finding under review must be classified with exactly one of these:

| Verdict | Meaning |
|---|---|
| `CONFIRMED` | Verified against the actual code / docs / test output, with evidence |
| `LIKELY` | Strongly indicated but not fully verified (note the gap) |
| `UNVERIFIED` | Cannot be confirmed or refuted with available access |
| `FALSE_POSITIVE` | Investigated and shown not to be a real issue |
| `NOT AN ISSUE` | Real behavior but not a defect (by design / acceptable trade-off) |

These are **verification** verdicts (how sure we are). They are distinct from the
resolution **status** used in ISSUE_REGISTER.md (OPEN / IN_PROGRESS / RESOLVED /
WONT_FIX). A `CONFIRMED` finding can still be `WONT_FIX` or `RESOLVED`.

## Read-Only Command Safety

The Desktop AI may only run a command if it is **known to be read-only** in the
current project/environment and does not generate, modify, cache, compile, or
otherwise change project state.

- **If there is any uncertainty about whether a command writes anything: DO NOT
  RUN IT.**
- Prefer inspection over execution. Reading files, searching, and listing are
  always safe; running tools is not.
- Do NOT run: formatters, build commands that generate output, dependency
  installation, migrations, seeders, code generation, or cache-writing commands.
- Examples of commands that may be acceptable **only when verified safe in this
  environment**: `php -l` (lint-only), `tsc --noEmit` (no emit), `git status` /
  `git log` / `git diff` (read-only inspection), and search commands. Even these
  must be re-checked: if a tool variant writes anything (e.g. a `.tsbuildinfo`
  file, a cache file, or a lockfile), do not run it.
- A command that could write must be noted in the report as a manual step for the
  human instead of being executed.

## Procedure

For each claim under verification:

### 1. Inspect the actual code

Read the real files. Quote `file:line` and relevant snippets as evidence. Do not
rely on the report's own claims — verify them.

### 2. Verify the proposed diagnosis

- Does the reported behavior actually exist?
- Does the claimed root cause match what the code does?
- Is there a different, more likely cause the report missed?

### 3. Identify evidence

Every verdict must have at least one piece of concrete evidence:
- Source excerpt (`file:line`)
- Documentation excerpt (`docs/…`)
- Test output — **only if the test run is known to be read-only** in this
  environment. Test runs that write to the database, cache, or filesystem are
  NOT read-only and must not be executed by the Desktop AI. If a test cannot be
  run safely, note it as a manual step for the human instead.

### 4. Reject unsupported claims

If a claim cannot be verified, mark it `UNVERIFIED` or `FALSE_POSITIVE`. Do not
softly endorse it. Never turn an unverified finding into a confirmed bug.

### 5. Identify missed issues

While inspecting the code, look for issues the report did not cover:
- Authorization gaps (is `$this->authorize()` present on every protected mutation?)
- Unvalidated input reaching Eloquent
- N+1 queries / missing eager loads
- SSRF / external URL handling weaknesses
- RTL property misuse, `any` types, missing loading/error/empty states
- Anything that assumes infrastructure the hosting does not have

### 6. Check security implications

For any change touching auth, external URLs, uploads, or public endpoints, run
the security lens explicitly. See `.opencode/skills/security-rules`.

### 7. Check regression risks

What existing behavior could this break? List affected tests and areas. Note that
the change must pass the existing suites (PHPUnit, Vitest, E2E, a11y) and the
quality commands (lint, type-check, Pint, format).

### 8. Distinguish confirmed findings from hypotheses

Deliver two lists:
- **Confirmed findings** (with evidence and verdict)
- **Hypotheses / open items** (with what would confirm them)

## Output Format

For each finding:

```
### <TAM-XXX or short name>

- **Claim:** <what was reported>
- **Verdict:** <CONFIRMED / LIKELY / UNVERIFIED / FALSE_POSITIVE / NOT AN ISSUE>
- **Confidence:** <High / Medium / Low>
- **Evidence:** <file:line + quote, or doc reference>
- **Impact:** <what breaks, or "none">
- **Production blocking:** <yes / no>
- **Recommended direction:** <next step, if any>
```

## Rules

1. **Strictly read-only.** Do not modify, create, or delete source, config, data,
   documentation, or any file. Do not update ISSUE_REGISTER.md, PROJECT_BASELINE,
   DECISION_LOG, or any docs/ai file — report findings; the human / Web AI updates
   the docs.
2. **Command safety.** Only run commands known to be read-only in this project and
   environment. If uncertain whether a command writes anything, DO NOT RUN IT.
   Prefer inspection over execution.
3. Quote evidence; do not paraphrase without a reference.
4. If you cannot run a command or read a file, say so and mark the claim
   `UNVERIFIED` for that part.
5. Multiple verifiers are better: an independent Desktop pass after a first
   verifier is recommended for HIGH/CRITICAL items.
6. Deliver a **verification report** as your output. Do not edit the register;
   the Web AI / human handles documentation updates after reviewing your report.
