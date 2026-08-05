---
name: skill-maintenance
description: How to maintain TamashaRoom's OpenCode skill system — when a new skill is justified, how to detect overlap, how to keep skills project-specific and token-efficient, and the validation checklist (frontmatter, references, stale claims, secrets). Use when adding, editing, merging, or removing a skill, or when updating AGENTS.md's skill table.
---

# Skill Maintenance

TamashaRoom's skills are the on-demand layer over `docs/SYSTEM.md`. They
must stay small, accurate, and non-overlapping. This skill covers keeping
them that way. For how skills are *used* to save tokens, see
`ai-efficiency` — that skill's rules are not repeated here.

## When a New Skill Is Justified

Create a new skill only when **all** are true:

- The capability is triggered repeatedly across tasks (a skill is a
  repeatable procedure, not a one-off note).
- No existing skill covers it, and it can't be a section added to an
  existing skill.
- It is project-specific: it encodes TamashaRoom facts (stack, constraints,
  files, commands), not generic advice.
- It has a clear trigger you can write in one sentence for the description.

If a task-specific procedure is only needed once, put it in the task notes,
not a skill.

## Detecting Overlap

Before adding or editing a skill:

- grep the other skills for the concept you're adding (e.g. "rate limit",
  "polling", "cn()"). If another skill already owns the rule, **cross-reference
  it** — don't duplicate the content.
- One-line mentions in a different context (e.g. "404 not 403" appearing in
  both security and routing contexts) are fine. A full restatement of a
  table/list owned elsewhere is not.
- When two skills overlap substantially: keep the more authoritative one,
  fold the other's unique content into it, delete the loser, update every
  backticked reference.

## Keeping Skills Project-Specific

- Every rule should trace to a verified repo fact: a file path, a command,
  a documented constraint. If it can't, it's generic advice — leave it out
  or link it to the exact source.
- Cite `docs/SYSTEM.md` chapters (`Full detail: docs/SYSTEM.md, Chapter NN`)
  so the skill is a summary, not a parallel source of truth.
- Prefer references over repetition: "see `security-rules`", "per
  `docs/deployment-checklist.md`".

## Keeping Skills Token-Efficient

- Target ≤ ~100 lines; the largest skills (`code-review-rules` ~143,
  `testing-strategy` ~140, `laravel-backend-rules` ~139) are the ceiling —
  don't grow them further.
- Frontmatter `description` is the trigger — make it state *when to use*
  (task types), not just *what the skill is about*.
- No code snippets that duplicate what's already in `docs/SYSTEM.md` —
  reference the chapter instead.
- One rule per bullet; no padding, no restating AGENTS.md.

## Validation Checklist (run after any skill change)

1. **Frontmatter**: the `name:` value must equal the directory name
   (`.opencode/skills/<name>/SKILL.md`).
2. **References resolve**: every backticked skill reference must be an
   existing skill directory. After a merge/removal, grep all skills +
   AGENTS.md + `docs/ai/**` for the deleted name.
3. **No stale claims**: grep for stale test counts (canonical counts live in
   `docs/TASK.md` — never hardcode them in skills) and removed APIs. Refresh
   `docs/TASK.md` when suites change.
4. **No duplicate instructions**: re-grep the concept you touched (see
   Detecting Overlap).
5. **No secrets**: no credentials, keys, tokens, or real `.env` values.
6. **AGENTS.md table in sync**: the skill table lists every skill with an
   accurate trigger; removed skills are gone from it.
7. **No architecture drift**: don't edit a skill to describe behavior the
   code doesn't have. Code wins; the skill (and docs) must be corrected to
   match reality, never the reverse.

## Checklist

- New skill justified by a repeated trigger and project-specific content.
- Overlap checked by grep before adding content.
- Cross-references instead of duplicated tables/rules.
- Frontmatter name == directory; AGENTS.md table updated.
- No stale counts, no deleted-skill references, no secrets.
