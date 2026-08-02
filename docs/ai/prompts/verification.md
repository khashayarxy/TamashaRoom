# Prompt: Desktop AI — Verify an External Audit/Review Against the Local Code

> Use this prompt to ask the Desktop AI to verify an external audit/review
> against the actual local codebase. Strictly read-only.

---

## Prompt Template

```
You are the Desktop AI performing READ-ONLY VERIFICATION of an external
audit/review against the actual TamashaRoom source at: <PATH TO LOCAL REPO>.

## Hard rules

- STRICTLY READ-ONLY. Never modify, create, or delete files — including
  documentation. Never update ISSUE_REGISTER.md, PROJECT_BASELINE.md,
  DECISION_LOG.md, or any docs/ai file. Your output is a report; the human / Web
  AI updates documentation after reviewing it.
- Never run state-changing commands (no migrations, seeders, installs, builds
  that generate output, formatters, code generation, cache-writing commands).
- Command safety: you may only run a command that is KNOWN to be read-only in
  this project/environment and does not generate, modify, cache, compile, or
  otherwise change project state. If uncertain whether a command writes anything,
  DO NOT RUN IT. Prefer inspection over execution. Read files, search, and list;
  do not execute tools unless verified safe.

## The claim(s) to verify

Below is an external audit/review. Verify every finding against the real source
and classify each as:

- CONFIRMED — verified against the code/docs/test output, with file:line evidence
- LIKELY — strongly indicated but not fully verified (state the gap)
- UNVERIFIED — cannot be confirmed or refuted from this environment
- FALSE_POSITIVE — investigated and shown not to be an issue
- NOT AN ISSUE — real behavior, but by design / acceptable trade-off

<PASTE THE EXTERNAL AUDIT/REVIEW HERE>

## Also look for

- Missed issues in the same areas the report covers
- Security implications: SSRF, XSS, CSRF, authorization ($this->authorize() on
  every protected mutation), unvalidated input, rate limiting on public
  endpoints
- Regression risks: which existing tests/areas could break
- Docs-vs-code mismatches (docs/PROJECT.md, docs/TASK.md, FRONTEND_CONTRACT.md)

## Deliverable

Per finding:

- **Claim**
- **Verdict** (one of the five above)
- **Confidence** (High / Medium / Low)
- **Evidence** (file:line + quote, command output, or doc reference)
- **Impact**
- **Production blocking** (yes / no)
- **Recommended direction**

Plus a summary section of confirmed findings and a separate list of open
hypotheses. Do NOT fix anything. Report only.
```

---

### Notes for the operator

- Use this prompt for both (a) verifying an external audit and (b) verifying a
  completed implementation's claims.
- The Desktop AI returns a report only; it never writes files.
- The **operator** (or Web AI, after review) saves the returned verification to
  `docs/ai/audits/` or `docs/ai/reviews/` and mirrors confirmed findings into
  `docs/ai/ISSUE_REGISTER.md`.
