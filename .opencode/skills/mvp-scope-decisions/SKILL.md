---
name: mvp-scope-decisions
description: The decision framework TamashaRoom uses to evaluate new feature requests and technical/architecture choices — MVP principles, the Decision Engine, RICE scoring, and the Scope Firewall. Use when asked to add a new feature, a new dependency, or when a request seems to expand scope beyond what's already defined in PROJECT.md and TASK.md.
---

# MVP Scope & Decision Framework

Full detail: `docs/SYSTEM.md`, Chapters 2 (Mission), 4 (Decision Engine), 5
(Product Thinking). Use this skill to push back constructively — not to
refuse work, but to surface trade-offs before building.

## MVP Principles (the default lens)

1. **One thing well.** TamashaRoom does synchronized watch-parties
   exceptionally well. It does not try to also be a general chat app, a
   media library, or a social network.
2. **No future-proofing.** Don't build a generic plugin system, config
   surface, or abstraction for a feature that doesn't exist yet.
3. **No placeholder content.** Every string, image, and interaction is real
   — no Lorem ipsum, no fake data, no "coming soon" screens shipped as done.
4. **Polish over scope.** A small, polished feature set beats a large rough one.
5. **Shippable every day.** No commits that break the build; no permanent
   "temporary" hacks.

## Before Building a New Feature — The Scope Firewall

Run every feature request through these questions, in order:

1. **Does a real user need this to complete their primary task** (creating a
   room, joining, watching in sync)? If no → don't build it.
2. **Can the user complete their task without it?** If yes → defer, don't build yet.
3. **Does it introduce complexity that slows the core flow?** If yes → simplify or defer.
4. **Can it be built without compromising the existing architecture** — the
   shared-hosting constraints in particular? If no → redesign or defer.

The response to "let's also add..." is: **"tell me the user outcome, and I'll
tell you if this is the best way to achieve it."**

## Before Adding a New Dependency — The Dependency Test

Every dependency is a liability, added intentionally and removed
aggressively. Before adding one, check:

1. Does this solve a problem we **actually** have right now — not "might have"?
2. Can it be solved with the standard library or what's already installed?
3. What's the total cost — bundle size, runtime cost, maintenance burden,
   learning cost, how hard to remove later?
4. What's the community health — issue resolution time, release cadence,
   who maintains it?
5. Worst case: if this is abandoned tomorrow, what breaks and how long to replace it?

Default to **not** adding a dependency. Require a justification that passes
this test.

## Architecture Decisions

For anything structural (state management approach, a new service layer, a
new caching strategy):

1. **Define the decision boundary precisely.** Not "how do we handle state"
   — "how do we manage global UI state vs. server state."
2. **Identify the forces** pushing each direction (team size, timeline,
   the single-core hosting constraint, existing patterns).
3. **List options with real trade-offs**, not just the one you want.
4. **Apply the project's actual constraints** (see `AGENTS.md` — no Docker,
   no Redis, no WebSockets, no persistent workers).
5. Prefer the option that's **reversible** — what does being wrong cost, and
   can it be undone in a week? A month? Ever?

## Prioritization — RICE

When multiple things compete for attention:

**Score = (Reach × Impact × Confidence) / Effort**

| Priority | Criteria | Action |
|---|---|---|
| Must | Required for MVP, no workaround | Build now |
| Should | Important, has a workaround | Build next |
| Could | Nice to have, no real user pain without it | Backlog |
| Won't | Out of scope for MVP | Reject explicitly, document why |

## Applying This to TamashaRoom Specifically

The single most common scope trap here is **anything that assumes
infrastructure this hosting doesn't have** — a feature that "would be easy
with Redis" or "just needs a background worker" is not easy here; it needs a
redesign for the shared-hosting budget (see `laravel-backend-rules` and
`performance-rules`), or it gets deferred to the post-VPS-migration phase
explicitly, the same way WebSocket-based playback sync already is.

When in doubt: check `docs/TASK.md` first. If something is already listed
under "Pending" or "Future Features," that's the existing scope decision —
don't silently re-litigate it mid-implementation. If it's not listed at all,
that's the signal to run the Scope Firewall before writing code.
