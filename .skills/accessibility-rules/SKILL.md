---
name: accessibility-rules
description: WCAG 2.2 AA accessibility rules for TamashaRoom — semantic HTML, keyboard navigation, screen readers, contrast, target size, and form accessibility. Use when building or editing any interactive component, page, form, or modal.
---

# Accessibility Rules

Full detail: `docs/SYSTEM.md`, Chapter 22 (Accessibility). AA is the
committed bar for this project, referencing WCAG 2.2 (the version behind
EN 301 549 and the European Accessibility Act).

## Core Requirements (SYSTEM.md 22.10)

- **Semantic HTML** over generic `<div>` + ARIA. Use `<button>`, `<nav>`,
  `<form>`, `<label>` — ARIA is a supplement, not a substitute.
- Logical heading hierarchy: `h1 → h2 → h3`, no skipped levels.
- All interactive elements are keyboard accessible; focus is visible and
  follows a logical order.
- Modals/drawers trap focus while open and restore it to the trigger on close.
- All images have meaningful `alt` text, or `alt=""` if purely decorative.
- Form inputs have associated `<label>`s; error messages link to their input
  with `aria-describedby`.
- Color contrast meets WCAG 2.2 AA (4.5:1 text, 3:1 UI); color is never the
  only signal.
- Dynamic content (toasts, live playback status) is announced via
  `aria-live` regions.
- Animations respect `prefers-reduced-motion`.
- Verified with keyboard-only navigation, a screen reader, and the automated
  axe audit in CI (`@axe-core/playwright`).

## Fully-Clickable Cards (stretched-link pattern)

- A card that is entirely navigable uses a stretched-overlay link
  (`absolute inset-0`); its accessible name comes from `aria-label` — don't
  duplicate the label in an `sr-only` span.
- Action buttons inside such a card (copy, delete) are **siblings** of the
  link, raised above it with `pointer-events-auto relative z-10` — never
  nested inside the `<a>` (interactive content inside a link fails WCAG
  4.1.2). The card surface is `pointer-events-none` so clicks land on either
  the link or a button.
- The link carries the visible focus treatment (`focus-visible:ring-2
  focus-visible:ring-ring`); keyboard focus lands on the link, never on a
  non-focusable wrapper `div`.

## WCAG 2.2-Specific Additions (easy to miss)

- **Target size**: interactive targets (buttons, icon buttons) are at least
  24×24 CSS pixels, or have enough spacing that a 24×24 area centered on the
  target doesn't overlap a neighbor. Icon-only buttons in dense toolbars
  (member list hover controls, chat actions) are the most common violation —
  keep the visual icon small but pad the hit area:
  ```tsx
  <button className="flex h-6 w-6 items-center justify-center">
    <TrashIcon className="h-4 w-4" />
  </button>
  ```
- **Focus not obscured**: a sticky header or toolbar must not fully cover a
  focused element as the page scrolls it into view. Use `scroll-margin-top`
  matched to the sticky element's height.
- **Dragging alternatives**: any drag interaction (reordering, resizing)
  needs a non-drag alternative (move-up/move-down buttons, keyboard equivalent).
- **Accessible authentication**: never require a cognitive test (remembering
  a password, transcribing a code) with no alternative. Allow pasting into
  password and one-time-code fields — never block paste on an auth input.
