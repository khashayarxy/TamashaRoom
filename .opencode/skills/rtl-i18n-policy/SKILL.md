---
name: rtl-i18n-policy
description: Use whenever implementing or modifying any UI feature/component in this
  project, to decide correctly whether it should be RTL, Persian-labeled, both, or
  neither. Prevents applying RTL/Persian broadly by default in ways that break UX or
  layouts that are meant to stay universal (e.g. media players, icons, numeric displays).
---

# RTL / Persian Localization Policy

This project is a Persian-speaking app, but RTL and Persian text must be applied
deliberately and narrowly — never as a blanket default across every component.

## Default rule: ASK before applying RTL or Persian to anything beyond simple text labels
Before implementing RTL direction, mirrored layouts, or Persian-language content on a
NEW feature or component, ask the user: "Should [this feature] be RTL, have Persian
labels, both, or stay as-is (LTR/English)?" Do not assume.

## Safe to do without asking
- Translating plain text labels, tooltips, error messages, placeholders to Persian, IF
  it doesn't require restructuring layout/direction.

## Requires asking first
- Applying dir="rtl" or mirroring CSS to any component.
- Reversing icon order, control positions, or visual flow.
- Anything inside the video player, progress bars, sliders, numeric/timer displays.
- Any component shared across multiple pages.

## Never do without explicit instruction
- Do not apply RTL to: the video player, icons, numeric/time displays, or any
  universal/language-neutral element — regardless of the page being Persian/RTL.
- Do not assume "the site is Persian" means "every component should be RTL."

## When in doubt
Leave direction/language as-is, implement the rest of the feature, and flag the open
question in your summary rather than guessing.
