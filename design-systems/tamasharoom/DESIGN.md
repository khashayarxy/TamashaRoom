# TamashaRoom Design System

> **version:** 1.0  
> **applies to:** TamashaRoom — synchronized watch-party platform  
> **status:** confirmed — landing page (Welcome.tsx) implemented per this spec (2026-08-05)

---

## Brand Identity

### Name

| Form | Usage |
|---|---|
| **تماشاروم** | The product's user-facing name — the ONLY form allowed in the UI, browser titles, meta/OG tags, accessibility text, or any user-facing content |
| **TamashaRoom** | Internal technical identifier — allowed ONLY in code identifiers, config keys, URLs, repository/file paths, env var names, HTTP headers, and this documentation set |

Canonical rule (product naming audit, 2026-08-06):

- The user-facing name is always **تماشاروم** — exactly that form, with no English/transliterated variant anywhere in the website UI, browser titles, meta/OG tags, alt text, or accessible text. This applies even when the surrounding text is English.
- The English form `TamashaRoom` must never be shown to a user. It survives only as a technical identifier: code, config keys, URLs, env var names, package/header names, and internal documentation.
- Wherever `TamashaRoom` does appear as a technical identifier it should be in title case — never `tamasha room`, `Tamasha Room`, or `Tamasha-room`.

### Voice & Tone

تماشاروم speaks like a friend who set up the couch, grabbed snacks, and queued the movie — not like a SaaS platform.

- **Warm, not corporate.** The feeling is "watching together on the couch with friends," not "real-time media synchronization platform."
- **Intimate.** Address the reader directly (second-person). Use the kind of Persian you'd use with friends, not in a formal letter.
- **Nostalgic.** The product exists because watching together in person is special, and being apart shouldn't mean losing that. Let that contrast — *together vs apart* — be the emotional throughline.
- **Low-friction.** Copy should never sound impressed with itself. No taglines like "Revolutionizing the way you watch." The best line is the one the user barely notices.

### Anti-Patterns to Avoid

These are explicitly forbidden — they contradict the brand's taste and constraints:

| Anti-pattern | Why |
|---|---|
| Purple-to-pink gradients | Overused in social/entertainment; reads as generic "startup branding" |
| Latin-primary type stacks | Latin-only typefaces have poor Persian glyph support — Vazirmatn is the primary typeface for all UI text; Inter is limited to the Latin glyphs that Vazirmatn's `unicode-range` deliberately excludes (SQL, invite codes, timestamps) |
| Logo-left / links-center / CTA-right nav | The default corporate nav pattern; تماشاروم should feel warmer |
| Icon-tile feature grids | "Feature boxes with rounded corners and an icon above text" — generic SaaS |
| Centered-everything layouts | No visual hierarchy, hard to scan. Use asymmetric, content-led layouts |
| Fabricated stats / testimonials | Dishonest; the product is pre-launch. Don't pretend otherwise |
| Glassmorphism as default | High rendering cost, accessibility issues, feels like a design trend |
| Spinners for every operation | Graduated response: nothing under 200ms, skeleton 200ms–1s, skeleton+progress beyond |

---

## Direction & Language

### Primary Language

**Persian (Farsi)** — the MVP ships in Persian only. English strings may exist in code for framework defaults but should be minimal and replaced where user-facing.

### Layout Direction

**RTL (right-to-left)** — this is mandatory for every page. There is no LTR mode, no locale toggle, no "also available in English."

Implementation rules (enforced at the framework level, not per-component):

- `<html lang="fa" dir="rtl">` on every page — set once, cascade everywhere.
- All spacing uses Tailwind logical properties: `ms-*` / `me-*` / `ps-*` / `pe-*` / `text-start` / `text-end`. Physical spacing utilities are not used; physical positioning is reserved for invariant placement such as centered or edge-to-edge overlays.
- Directional icons (arrows, chevrons for back/forward, skip) are mirrored for RTL. Non-directional icons (checkmark, trash, play, pause, settings) are never mirrored.
- Progress indicators and slider tracks fill from right to left in RTL.
- Drawer/slide-in panels enter from the right (start side in RTL).

### Mixed-Direction Content

Within RTL Persian text, certain content stays LTR:

- Latin brand names, URLs, invite codes
- Code snippets
- (For numerals, see "Numerals" below — only *some* numbers stay LTR)

Wrap these explicitly:

```html
<span dir="ltr" class="inline-block">{room.inviteCode}</span>
```

Reversed digits in an invite code or timestamp aren't just odd — they're unreadable users will not forgive this.

### Numerals

Two numeral systems exist in the product, and choosing the wrong one for a given context is a visible bug. The rules:

**Stays Latin / English (unchanged):**

- **Invite codes** — alphanumeric (mixing Persian digits with Latin letters in the same code would be confusing and error-prone to type/share).
- **Any other identifier** meant to be typed, copied, or shared verbatim (e.g. room IDs if user-facing).
- **Monospace data** (debug info, raw timestamps in technical contexts).

**Uses Persian (Eastern Arabic-Indic) digits — ۰۱۲۳۴۵۶۷۸۹:**

- **Dates and relative timestamps** ("۳ روز پیش").
- **Member/participant counts** ("۵ نفر آنلاین").
- **Playback time / duration display** (video position, total time).
- **Clock times** (hours:minutes).
- **Any other count or quantity** shown in natural-language Persian UI text.

**Rule of thumb:** if the number appears inside Persian sentence context (a count, a date, a duration a person reads as part of the sentence), use Persian digits. If it's a literal code/identifier meant to be typed or shared exactly as shown (invite codes, URLs), keep it Latin.

**Implementation:** a small utility function `toPersianDigits()` that converts numeric output to Persian numeral glyphs at the point of display, applied to every Persian-context number except invite codes and other literal identifiers.

### Calendar System

All user-facing dates use the **Jalali (Persian / Solar Hijri)** calendar, not Gregorian.

This includes:
- Room creation date ("ایجاد شده در ۱۵ تیر ۱۴۰۵").
- "Joined X days ago" / relative timestamps ("۳ روز پیش پیوست").
- Any calendar date shown to the user in UI text.

**Implementation:** A Jalali date library is required for the frontend. Options (choose the lightest that fits the bundle budget):
- `date-fns-jalali` — wraps the already-common `date-fns` API for Jalali.
- `jalali-moment` — heavier (wraps moment.js), only if date-fns-jalali doesn't cover needed formats.
- Prefer a tree-shakable solution; the MVP only needs relative timestamps and a few format patterns (`DD MMMM YYYY` in Jalali).

Relative timestamps must use Persian phrasing conventions, not translated English relative-time strings. For example:

| English | Persian |
|---|---|
| "3 days ago" | "۳ روز پیش" |
| "Just now" | "همین الان" |
| "2 hours ago" | "۲ ساعت پیش" |
| "Yesterday" | "دیروز" |
| "1 month ago" | "۱ ماه پیش" |

The library should also provide a formatter that outputs Jalali month names (فروردین, اردیبهشت, etc.).

---

## Typography

### Face Selection

Override SYSTEM.md §11.02 (which recommended Inter): **Vazirmatn is the primary typeface for all UI, body, and heading text.** Inter does not support Persian script properly, and تماشاروم's audience is Persian-speaking. Inter's role is strictly the Latin fallback for glyphs Vazirmatn deliberately excludes (see the Latin fallback row below).

| Role | Typeface | Rationale |
|---|---|---|
| **Body & UI** | Vazirmatn (variable) | Excellent Persian glyph coverage, variable format (100–900 weight), open source, designed for screen reading. Feels native to the script, not a Latin typeface forcing Persian glyphs. |
| **Display / Headings** | Vazirmatn (same variable file, heavier weights) | One typeface is sufficient for MVP — Vazirmatn's heavier cuts (700–900) provide enough contrast with body weight to create hierarchy without a second face. |
| **Latin fallback** | Inter (variable, `@fontsource-variable/inter`) | Vazirmatn's `@font-face` declares a `unicode-range` limited to Persian scripts, so Latin glyphs (SQL, invite codes, numeric timestamps in `dir="ltr"` spans) fall through to the next family in the stack. Inter Variable fills that role, replacing the generic system-ui fallback. It is never used for Persian text — Vazirmatn always wins the Persian code points. |
| **Monospace / Codes** | JetBrains Mono or Geist Mono | For invite codes, debug data, timestamps rendered as monospace. Not used in general UI. |

No decorative or third typeface. Vazirmatn variable covers every weight need (100–900) from a single `woff2` file.

### Font Loading

- Self-hosted Vite asset: `resources/fonts/vazirmatn-var.woff2` (declared in `resources/css/fonts.css` and preloaded through `Vite::asset()` in the root Blade template) plus `@fontsource-variable/inter` for Latin fallback.
- `font-display: swap` — text is never invisible
- `font-weight: 100 900` — variable access to all weights
- Fallback stack: `'Vazirmatn', 'Inter Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Type Scale

Same major-third (1.25) scale from SYSTEM.md §11.03, adapted for Vazirmatn's metrics:

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 12px | 1.5 | 400, 500 | Captions, timestamps, badges |
| `text-sm` | 14px | 1.5 | 400, 500 | Secondary text, form labels |
| `text-base` | 16px | 1.5 | 400, 500 | Body text, button labels |
| `text-lg` | 18px | 1.5 | 400, 500 | Lead paragraphs |
| `text-xl` | 20px | 1.4 | 500, 600 | Small headings, card titles |
| `text-2xl` | 24px | 1.3 | 600, 700 | Section headings |
| `text-3xl` | 30px | 1.2 | 600, 700 | Page headings |
| `text-4xl` | 36px | 1.1 | 700 | Hero headings |
| `text-5xl` | 48px | 1.1 | 700 | Large hero |
| `text-6xl` | 60px | 1.0 | 700 | Display (rare) |

Max 4–5 distinct sizes per screen. Vazirmatn at heavier weights (700+) will be used for headings to create distinctive mass — nothing else in the system carries that weight, so headings will stand out even before color enters the equation.

---

## Color System

### Directional Shift

SYSTEM.md §12 defines cool grays (blue undertone) and a generic blue primary. A later revision (2026-08-05) moved to a warm amber/charcoal palette. This document now overrides both with a **dark indigo-first palette** — near-black backgrounds with an indigo primary and a rose destructive:

1. Indigo and rose on near-black evoke the shared evening cinematic mood the brand needs.
2. Video playback demands a dark backdrop for contrast — near-black `#0A0A0F` (not pure black, not cool gray) keeps the surrounding UI cohesive with the content being watched.
3. The brand hues (`#6366F1` indigo, `#F43F5E` rose) appear at full strength in `--ring`, `--info`, tints, and the landing page's accents; solid fills use the AA-safe 600-level shades so small text always clears WCAG 2.2.

### Base Palette

```
Brand primary hue:       Indigo-500   —  HSL(239, 84%, 67%)        #6366F1
Brand destructive hue:   Rose-500     —  HSL(350, 89%, 60%)        #F43F5E
Solid primary fill:      Indigo-600   —  HSL(243, 75%, 59%)        #4F46E5
Solid destructive fill:  Rose-600     —  HSL(347, 77%, 50%)        #E11D48
Dark bg:      Near-black indigo  —  HSL(240, 20%, 5%)      #0A0A0F
Dark surface: Slightly lighter  —  HSL(240, 15%, 8%)       #14141F
Dark border:  Subtle divider    —  HSL(240, 15%, 18%)      #262630
```

### Semantic Tokens (CSS custom properties)

These follow the same semantic role structure from SYSTEM.md §12.02:

```css
/* Light mode */
:root {
  --primary:         243, 75%, 59%;        /* #4F46E5 — indigo-600, AA-safe fill */
  --primary-foreground: 0, 0%, 100%;       /* white text on indigo fill */

  --background:      240, 25%, 98%;        /* near-white indigo-tinted */
  --foreground:      240, 20%, 8%;         /* indigo-near-black text */

  --card:            240, 25%, 99%;        /* card bg */
  --card-foreground: 240, 20%, 8%;

  --muted:           240, 15%, 92%;
  --muted-foreground: 240, 10%, 45%;       /* darkened for 4.5:1 on background */

  --border:          240, 15%, 88%;
  --input:           240, 15%, 86%;
  --ring:            239, 84%, 67%;        /* #6366F1 — brand indigo focus ring */

  --secondary:       240, 15%, 92%;
  --secondary-foreground: 240, 20%, 12%;

  --accent:          243, 60%, 94%;
  --accent-foreground: 243, 60%, 35%;

  --destructive:     347, 77%, 50%;        /* #E11D48 — rose-600 fill */
  --destructive-foreground: 0, 0%, 100%;

  --success:         152, 60%, 42%;        /* #3B8C4E — green */
  --success-foreground: 0, 0%, 96%;
  --warning:         38, 92%, 50%;         /* amber — kept for semantic severity */
  --warning-foreground: 30, 15%, 10%;
  --info:            239, 84%, 67%;        /* #6366F1 */
}

/* Dark mode — near-black indigo, not pure black */
.dark {
  --background:      240, 20%, 5%;         /* #0A0A0F */
  --foreground:      240, 20%, 96%;        /* near-white indigo-tinted */

  --card:            240, 15%, 8%;         /* #14141F */
  --card-foreground: 240, 20%, 96%;

  --muted:           240, 12%, 14%;
  --muted-foreground: 240, 10%, 62%;

  --border:          240, 15%, 18%;        /* #262630 */
  --input:           240, 15%, 20%;
  --ring:            239, 84%, 67%;        /* #6366F1 */

  --secondary:       240, 12%, 14%;
  --secondary-foreground: 240, 15%, 92%;

  --accent:          243, 60%, 22%;
  --accent-foreground: 243, 80%, 88%;

  --primary:         243, 75%, 59%;        /* #4F46E5 — indigo-600 fill */
  --primary-foreground: 0, 0%, 100%;

  --destructive:         347, 77%, 50%;    /* #E11D48 */
  --destructive-foreground: 0, 0%, 100%;

  --success:         152, 60%, 50%;
  --success-foreground: 0, 0%, 96%;
  --warning:         38, 92%, 55%;
  --warning-foreground: 30, 15%, 10%;
  --info:            239, 84%, 67%;        /* #6366F1 */
}
```

### Why Both Mode Share One Primary Fill

The brand indigo `#6366F1` (relative luminance ≈ 0.185) sits just under the 4.5:1 small-text threshold against white (≈ 4.47:1), so it cannot host white small text (`text-primary-foreground` on solid `bg-primary`) or serve as small `text-primary` on light backgrounds. It is reserved for `--ring`, `--info`, and tinted decorations where ≥3:1 (UI component) is the requirement.

Solid fills use the one-step-darker 600-level shades in both modes — `--primary: #4F46E5` (~6.3:1 vs white) and `--destructive: #E11D48` (~4.9:1 vs white) — so every button clears WCAG 2.2 AA with a pure-white foreground. This removes the amber palette's light/dark primary split: one indigo fill, one rose fill, both modes.

> Do not lighten `--primary` back to #6366F1 for solid fills or small text — it fails WCAG 2.2 AA (4.47:1 < 4.5:1). Keep #6366F1 for ring, info, and tinted decorations only.

### Accent Restraint

The indigo (`--primary`) must read as an accent — not a surface color.

- **CTA buttons, brand marks, highlights, focus rings, active states** — these own the indigo.
- **Never** use indigo as a background for large surface areas (cards, sidebars, full-screen sections). The one exception is the hero section on the landing page, where it may be used sparingly as a directional color block.
- Follow the 70-20-10 rule: ~70% neutral (near-black indigo-tinted grays), ~20% secondary (muted surfaces), ~10% accent (indigo, rose, green, etc.).
- The in-room Operate mode keeps indigo below the video itself; it is restricted to the sidebar, the controls bar, and chat badges — never overlaid on the video frame.

### The Gray Scale (Indigo-Tinted)

All grays carry a cool, indigo-based undertone that matches the brand backgrounds:

| Token | Light | Dark | Usage |
|---|---|---|---|
| gray-50 | #F7F7FB | — | Page bg |
| gray-100 | #EDEDF6 | — | Card bg |
| gray-200 | #DFE0EC | — | Borders |
| gray-300 | #C6C8DD | — | Disabled borders |
| gray-400 | #A3A6C4 | — | Placeholder, disabled |
| gray-500 | #7C7FA3 | — | Secondary text |
| gray-600 | #565973 | — | Body text (dark) |
| gray-700 | #3C3E54 | — | Headings (dark) |
| gray-800 | #262838 | — | Strong heading (dark) |
| gray-900 | #0A0A0F | — | Page bg (dark) |

### Semantic Token Usage

| Token | Used For |
|---|---|
| `bg-background` | Page/screen background |
| `bg-card` | Card, panel, container backgrounds |
| `bg-muted` | Hover states, tertiary surfaces |
| `bg-primary` | Primary CTA buttons, active tab indicators, brand marks |
| `text-foreground` | Primary body text |
| `text-muted-foreground` | Secondary text, labels, captions |
| `text-primary` | Primary brand text (used sparingly — links, highlights) |
| `border` | All borders, dividers, separators |
| `ring` | Focus ring on interactive elements |

---

## Product Modes

تماشاروم has two distinct visual modes with different priorities. They are not "light vs dark" — they are contexts, and each exists in both light and dark color schemes.

### Persuade Mode — Landing Page

**Goal:** Sell the feeling of watching together. Convert a visitor into a signed-up user.

**Characteristics:**
- **Expressive.** Room for typographic emphasis, larger hero text, a single hero graphic or illustration, and a short emotive tagline.
- **Generous spacing.** Looser layouts, more whitespace, asymmetric positioning. This is not a dense dashboard.
- **One clear CTA.** The primary action (register / create room) is visually dominant. There is exactly one of those per viewport.
- **Minimal UI chrome.** No sidebar, no complex navigation. A simple header with brand mark, one or two links, and a register button.
- **Persian-first copy.** The tagline, value prop, and calls-to-action are written in warm Persian — not translated from English.
- **Color: indigo is allowed in slightly larger doses** (as a background accent strip, a hero color block) but never as a dominant surface.

**Layout principle:** Content-led asymmetry. Not centered. Not grid-locked. Let the message dictate the layout, not the other way around.

### Operate Mode — In-Room / Playback UI

**Goal:** Get out of the way. The video is the hero; everything else is peripheral.

**Characteristics:**
- **Dark default.** In-room UI should default to dark mode regardless of the user's system preference. The video is being watched in a dark environment (real or implied). A light background during playback is physically uncomfortable.
- **Minimal chrome.** Controls fade out (auto-hide) after a pause in interaction. Show on hover/tap.
- **Scannable at a glance.** Sync status, member list, and chat notifications are visually accessible without hovering or clicking — but they are **small**, occupying the periphery (right sidebar, bottom overlay).
- **Transparencies and blur.** Controls and overlays sit on the video itself using `bg-background/80` and `backdrop-blur` — not opaque panels that steal attention from the video.
- **No brand color in the video area.** Amber is restricted to the sidebar, the controls bar, and chat badges — never overlaid on the video frame itself. The video is the only thing that should draw attention during playback.
- **Audio feedback discouraged.** The user is already listening to audio from the video.
- **Progressive disclosure.** Chat, members list, subtitles panel are tabs or toggle-able overlays, not always-visible panels.

**Layout principle:** The video frame occupies ≥70% of viewport height on desktop. Everything else is an overlay, a sidebar (thin, <320px), or a bottom sheet on mobile.

---

## Spacing

Use the standard Tailwind spacing scale. No ad hoc pixel values.

| Token | Value | Usage |
|---|---|---|
| `gap-1` / `p-1` | 4px | Micro spacing (icon to text, badge) |
| `gap-2` / `p-2` | 8px | Tight spacing (button groups, form rows) |
| `gap-3` / `p-3` | 12px | Default spacing (card content, section padding) |
| `gap-4` / `p-4` | 16px | Section padding, card padding |
| `gap-6` | 24px | Between major sections |
| `gap-8` | 32px | Hero sections, landing page |
| `gap-12` | 48px | Full-screen sections, generous breaks |

### Operate Mode Spacing

In-room UI uses tighter spacing (`gap-2`, `gap-3`) to maximize screen real estate for the video. The sidebar is `w-72` (288px) or `w-80` (320px) at most.

### Persuade Mode Spacing

Landing page uses more generous spacing (`gap-6`, `gap-8`, `gap-12`) to create breathing room and emphasize the message.

---

## Motion

### Principles

1. **Functional, not decorative.** Every animation must serve a purpose: indicate state change, guide attention, provide feedback. No decorative parallax, no scroll-triggered reveals, no fade-in-on-appear for its own sake.
2. **Short.** Dramatic animations belong in presentations, not in a product. 150–300ms for micro-interactions, 300–500ms for transitions. Never exceed 500ms for UI motion.
3. **Respect `prefers-reduced-motion`.** All animations must use `@media (prefers-reduced-motion: no-preference)` or the Tailwind equivalent.
4. **CSS transitions** over JavaScript animation for anything that doesn't need gesture input.

### Recommended Curves

| Context | Curve | Duration |
|---|---|---|
| Micro-interactions (hover, focus, tap) | `ease-out` | 150ms |
| Panel/sidebar open/close | `cubic-bezier(0.16, 1, 0.3, 1)` (emphasized ease-out) | 300ms |
| Fade overlay (controls show/hide) | `ease-in-out` | 250ms |
| Page transitions (Inertia) | `ease-out` | 200ms |

---

## Iconography

### Library

**Lucide React** — already in the dependency tree. Do not add a second icon library.

### RTL Mirroring Rules

| Icon Type | Example | Mirror in RTL? |
|---|---|---|
| Directional | `ChevronLeft`, `ChevronRight`, `ArrowLeft`, `ArrowRight`, `SkipBack`, `SkipForward` | **Yes** — flip so the meaning (forward = direction of reading) is preserved |
| Direction-neutral | `Play`, `Pause`, `Trash2`, `X`, `Check`, `MessageCircle`, `Users`, `Settings`, `Plus` | **No** — these have no reading-direction implication |
| Ambiguous | `Undo`, `Redo` | **Undo = mirror** (in RTL, undo goes the other way). Redo follows. |

Implementation: In RTL contexts, wrap the icon component so Lucide's `ChevronRight` is rendered as `ChevronLeft` and vice versa. Do not apply CSS `transform: scaleX(-1)` — it breaks the icon's visual alignment in some renderers.

---

## Implementation Constraints

### Tailwind CSS 4 Compatibility

All tokens above must be defined using Tailwind CSS 4's `@theme` directive (CSS-first config), not the legacy `tailwind.config.js`:

```css
@import "tailwindcss";

@theme {
  --color-primary: hsl(243 75% 59%);
  --color-primary-foreground: hsl(0 0% 100%);
  --color-background: hsl(240 25% 98%);
  --color-foreground: hsl(240 20% 8%);
  /* ... etc for every semantic token above */
}
```

### Existing Utility Compatibility

- Use the existing `cn()` helper for conditional class merging.
- Interactive primitives come in two tiers: (1) the project's shadcn-style `resources/js/Components/ui/` primitives (built on `@radix-ui/*` — dialog, popover, select, switch, tabs, tooltip) for new, complex, composable behaviors; and (2) existing Headless UI / native `<dialog>` modal patterns that are already shipped untouched. Do not introduce a third headless library.
- Follow existing component categories (composite, primitives, widgets, layouts, pages) established in `docs/SYSTEM.md` §04.

### Dark Mode

- Implemented via a `.dark` class on `<html>` (Tailwind's `class` strategy).
- The in-room Operate mode should default to dark regardless of system preference.
- All color tokens have validated WCAG 2.2 AA contrast ratios in both modes.

---

## Page-by-Page Guidance

*This section maps the design system to each page in the product. Filled out during implementation; placeholders listed now.*

| Page | Mode | Key Design Decisions |
|---|---|---|---|
| **Landing (Welcome)** | Persuade | Hero with Vazirmatn display weight, near-black indigo-tinted section, single CTA. No feature grid. |
| **Dashboard** | Operate | Compact room information cards without poster thumbnails, minimal chrome, dark default. Room list timestamps use Persian digits (e.g. "created ۱۵ تیر ۱۴۰۵") and Persian relative time (e.g. "۳ روز پیش"). |
| **Room Show (in-room)** | Operate | Video ≥70% viewport. Fading overlay controls. Sidebar (chat/members/subtitles tabs). Invite code is displayed with `dir="ltr"` and stays in Latin characters — not converted to Persian digits. |
| **Login / Register** | Persuade | Card on indigo-tinted off-white. Minimal visual weight. No illustration — just form + brand mark. |
| **Profile** | Operate | Simple inline form. Dark card layout. No avatars, no settings sections yet. |
