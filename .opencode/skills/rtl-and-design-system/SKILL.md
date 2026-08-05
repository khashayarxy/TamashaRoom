---
name: rtl-and-design-system
description: RTL/Persian typography, color system, dark mode, layout, and motion rules for TamashaRoom's design system. Use when building or styling any UI screen, especially anything involving text direction, spacing, color tokens, or animation.
---

# RTL & Design System

Full detail: `docs/SYSTEM.md`, Chapters 7-13 (Design Philosophy through Motion
Design) and 11.08 specifically for RTL.

## RTL Is the Default, Not a Mirrored Afterthought

Persian is the primary — for the MVP, the only — language, and it is written
right-to-left. Design directly in RTL; do not design in LTR and mirror it after.

- **Typeface**: Vazirmatn (self-hosted variable webfont), not a Latin
  typeface's fallback rendering, which renders Persian glyphs poorly.
  ```css
  @font-face {
    font-family: 'Vazirmatn';
    src: url('/fonts/vazirmatn-var.woff2') format('woff2');
    font-weight: 100 900;
    font-display: swap;
  }
  ```
- **Set direction once, at the root**, and let it cascade:
  `<html lang="fa" dir="rtl">`. Never set `dir` on individual components.
- **Use Tailwind's logical properties** — `ms-*`, `me-*`, `ps-*`, `pe-*`,
  `text-start`, `text-end` — which flip automatically with the document's
  `dir`. **Never** use physical-direction utilities (`ml-*`, `mr-*`, `pl-*`,
  `pr-*`, `left-*`, `right-*`) — they don't flip and produce subtly-wrong
  spacing/alignment in RTL.
- **Mixed-direction content stays LTR even inside RTL text**: numbers, Latin
  brand names, URLs, invite codes. Wrap them explicitly:
  ```tsx
  <span dir="ltr" className="inline-block">{room.inviteCode}</span>
  ```
  Reversed digits in an invite code or timestamp aren't just odd — they're unreadable.
- **Persian-context numerals use Persian digits (۰–۹)** via `toPersianDigits()`
  from `@/lib/utils`, applied at display — Latin digits inside natural-language
  Persian text (counts, durations, relative times) violate DESIGN.md. Exception:
  literal identifiers meant to be typed/shared exactly (invite codes, URLs)
  stay Latin and keep `dir="ltr"`.
- Icons that imply direction (arrows, chevrons for back/forward) get mirrored
  for RTL. Icons whose meaning is direction-independent (checkmark, trash
  icon) must **not** be mirrored.

## Dark Mode

First-release requirement, not an overlay — every screen is designed and
reviewed in both light and dark mode from the start. Defined via CSS custom
properties and Tailwind's `@theme` (see the `typescript-tailwind-rules`
skill for the CSS-first config mechanics).

## Layout & Spacing

- Use the project's defined spacing scale, not ad hoc pixel values.
- Mobile-first responsive strategy — design for the smallest viewport first,
  add complexity at larger breakpoints.
- Respect `z-index` layering conventions already established in the codebase
  rather than introducing new arbitrary stacking values.

## Motion

- Motion should serve a functional purpose (indicate state change, guide
  attention, provide feedback) — not decoration for its own sake.
- All animations respect `prefers-reduced-motion`.
- Prefer CSS transitions/animations over JS-driven animation for anything
  that doesn't need to respond to gesture input.

## Color

- Use the project's semantic color tokens (`bg-background`,
  `text-foreground`, etc.) — never introduce new raw hex values inline.
- Color contrast must meet WCAG 2.2 AA (4.5:1 text, 3:1 UI elements) in
  **both** light and dark mode — see the `accessibility-rules` skill.
- Information is never conveyed by color alone (e.g. online/offline status
  needs a label or icon, not just a green/gray dot).

## Common Mistakes to Avoid

- `ml-*`/`mr-*`/`pl-*`/`pr-*` instead of logical equivalents.
- Directional icons not mirrored for RTL (or non-directional icons mirrored
  when they shouldn't be).
- Numbers/Latin identifiers rendered without `dir="ltr"`, causing them to
  reverse inside RTL text.
- Arbitrary hex colors instead of semantic tokens, breaking dark mode.
- Loading spinners for every async operation regardless of duration — see
  the `code-review-rules` skill for the graduated response (no indicator under
  200ms, skeleton 200ms-1s, skeleton + progress beyond 1s).
