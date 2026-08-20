---
name: aesthetic-composition-rules
description: Use when designing a new screen, page, or non-trivial UI section (anything not already fully specified in DESIGN.md's page-by-page guidance) — landing sections, dashboard states, empty states, new room features, admin/moderation UI, etc. Governs the PROCESS of composing a screen and judging whether the result looks distinctive or generic, and when to check with the user vs. decide independently. Does NOT define tokens (color/type/spacing/motion) — those live in DESIGN.md and rtl-and-design-system, and this skill defers to them completely.
---

# Aesthetic Composition Rules

DESIGN.md defines TamashaRoom's tokens: dark indigo/rose palette, Vazirmatn/Inter type scale, spacing, motion curves, and an anti-pattern table (no gradients, icon-tile grids, glassmorphism, centered-everything, spinner-for-everything, corporate nav). Those rules are settled — never override them here.

What DESIGN.md does not cover is *how to compose a specific screen* using those tokens without the result reading as generic. That's this skill's job. It applies whenever a screen isn't already decided in DESIGN.md's page-by-page section (Landing, Dashboard, Room Show, Login/Register, Profile are decided — everything else is a stub).

## When to apply this skill

- A new page or major section is being built (landing sub-section, settings screen, moderation UI, empty/error states not yet specified)
- DESIGN.md's page-by-page guidance says "placeholder" for the screen in question
- Reworking an existing screen's layout/composition (not just fixing a token violation)

Skip it for: pure copy edits, bug fixes, token-only changes (swap a color for its documented semantic equivalent), or any screen DESIGN.md already fully specifies.

## Process: plan before building

**1. Name the screen's one job.** Every screen does one primary thing. State it in one sentence before doing anything else (e.g., "this empty state tells a first-time user how to create their first room and gets them there in one click"). If the job is unclear, that's a question for Khashayar, not a guess.

**2. Choose Persuade or Operate mode explicitly.** DESIGN.md defines this distinction but doesn't mandate stating it per-screen. Before composing, say which mode this screen is in and why — a landing sub-section is usually Persuade, a settings panel is usually Operate. This one decision drives density, copy tone, and how much visual weight the hero element gets.

**3. Sketch composition in words or ASCII before code.** One or two sentences on layout concept, plus a rough wireframe if the structure isn't obvious from the component category alone. Identify: what's the single most important element (the thing a first-time viewer's eye should land on), and what structural device (if any — numbering, dividers, eyebrows) actually encodes something true about this content. Don't add a structural device just because it looks organized; only if the content is genuinely sequential/categorized.

**4. Self-check against genericness before writing code.** Ask: if I ran this same brief through the same process for five different SaaS products, would I land here every time? If yes, the layout is a default, not a decision — revise. Concretely check the plan against DESIGN.md's anti-pattern table plus these composition-level tells:
   - Hero is a big number + label + gradient blob (unless the content is genuinely a headline stat)
   - Three-column feature grid with icon-over-title-over-sentence, repeated verbatim in structure
   - Every section centered with the same vertical rhythm, no variation in density or emphasis
   - A structural device (01/02/03, cards-in-a-row) applied because it's tidy, not because the content is a sequence

**5. Build to the plan, then critique once more.** After building, look at it again (screenshot via the chrome-devtools or playwright MCP if the change is visual) and ask the same genericness question. One real revision pass beats zero.

## When to decide vs. when to ask Khashayar

Decide independently when:
- The screen's job and mode are clear from context (e.g., a settings toggle panel is obviously Operate)
- DESIGN.md's tokens and anti-pattern table already rule out the risky choices
- The composition question is really a token application question (spacing, hierarchy) already answered by DESIGN.md or `rtl-and-design-system`

Stop and ask when:
- The screen is customer-facing and new (not a variant of an existing decided page) — e.g., a new landing section, a new marketing surface
- There's a real trade-off between Persuade and Operate that changes the screen's purpose, not just its polish
- The self-check in step 4 flags the plan as generic and no clearly better alternative presents itself — report the tension rather than silently picking one
- The screen introduces a new structural pattern not yet used elsewhere in the product (new card type, new nav pattern, new empty-state style) — this is a precedent-setting decision, not just a local one

## Closing the DESIGN.md stub gap

For any screen where DESIGN.md says "placeholder": before building, add a short entry to DESIGN.md's page-by-page section following the same format as the existing decided pages (mode, one-line composition rationale, any screen-specific exceptions to the base tokens). This keeps the design system from drifting out of sync with what's actually shipped, and gives the next agent a decided reference instead of another stub.

## Restraint check

Spend visual boldness in exactly one place per screen — DESIGN.md's anti-pattern table already forbids most of the ways this goes wrong (glassmorphism, gradients, spinner-everywhere). The remaining risk is *composition* boldness: don't add a second "signature" layout idea on top of an already-decided one elsewhere on the same page. If a screen has a hero moment, everything else on it should be quiet by comparison.
