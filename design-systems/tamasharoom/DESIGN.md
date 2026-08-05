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
| Inter as everything | Inter has poor Persian glyph support — Vazirmatn replaces it for UI |
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

Override SYSTEM.md §11.02 (which recommended Inter): **Vazirmatn is the new primary typeface for all UI, body, and heading text.** Inter does not support Persian script properly, and تماشاروم's audience is Persian-speaking.

| Role | Typeface | Rationale |
|---|---|---|
| **Body & UI** | Vazirmatn (variable) | Excellent Persian glyph coverage, variable format (100–900 weight), open source, designed for screen reading. Feels native to the script, not a Latin typeface forcing Persian glyphs. |
| **Display / Headings** | Vazirmatn (same variable file, heavier weights) | One typeface is sufficient for MVP — Vazirmatn's heavier cuts (700–900) provide enough contrast with body weight to create hierarchy without a second face. |
| **Monospace / Codes** | JetBrains Mono or Geist Mono | For invite codes, debug data, timestamps rendered as monospace. Not used in general UI. |

No decorative or third typeface. Vazirmatn variable covers every weight need (100–900) from a single `woff2` file.

### Font Loading

- Self-hosted Vite asset: `resources/fonts/vazirmatn-var.woff2`, declared in `resources/css/fonts.css` and preloaded through `Vite::asset()` in the root Blade template.
- `font-display: swap` — text is never invisible
- `font-weight: 100 900` — variable access to all weights
- Fallback stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

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

SYSTEM.md §12 defines cool grays (blue undertone) and a generic blue primary. This document overrides that with a **warm palette** — amber/mustard yellow primary, warm dark backgrounds — because:

1. Warm tones evoke the nostalgia and intimacy the brand needs.
2. Video playback demands a dark backdrop for contrast — warm dark (not pure black or cool gray) makes the surrounding UI feel cohesive with the content being watched.

### Base Palette

```
Primary accent (dark mode):     Amber / Mustard yellow   —  HSL(40, 90%, 50%)        #E8A817
Primary accent (light mode):    Deep warm amber          —  HSL(40, 85%, 30%)        #8E620B
Warm dark bg:     Deep warm charcoal        —  HSL(30, 10%, 10%)        #1C1815
Warm surface:     Slightly lighter warm     —  HSL(30, 8%, 16%)         #29231E
Warm border:      Subtle warm divider       —  HSL(30, 6%, 25%)         #403A34
```

### Semantic Tokens (CSS custom properties)

These follow the same semantic role structure from SYSTEM.md §12.02, with warm-toned values:

```css
/* Light mode (default — warm, not cool) */
:root {
  --primary:         40, 85%, 30%;       /* #8E620B — darkened amber for ≥4.5:1 on light bg */
  --primary-foreground: 40, 10%, 93%;   /* #EFEBE3 — light text on dark amber */

  --background:      40, 20%, 96%;       /* #F5F0EA — warm off-white */
  --foreground:      30, 15%, 10%;       /* #1C1815 — warm black text */

  --card:            40, 15%, 93%;       /* #EBE5DD — card bg */
  --card-foreground: 30, 15%, 10%;

  --muted:           40, 10%, 88%;       /* #E0D9D0 */
  --muted-foreground: 30, 12%, 21%;     /* #3B342E — darkened for 4.5:1 on background */

  --border:          40, 10%, 50%;       /* #8C8273 — darkened for ≥3:1 non-text contrast */
  --ring:            40, 85%, 30%;       /* focus ring — matches primary */

  --secondary:       40, 8%, 85%;        /* #DBD2C6 */
  --secondary-foreground: 30, 15%, 10%;

  --destructive:     0, 70%, 50%;        /* #D9534F — red, same hue regardless of temp */
  --destructive-foreground: 0, 0%, 96%;

  --success:         140, 50%, 45%;      /* #3B8C4E — green */
  --success-foreground: 0, 0%, 96%;

  --warning:         45, 90%, 50%;       /* #E8A817 */
  --warning-foreground: 30, 15%, 10%;
}

/* Dark mode — warm dark, not pure black */
.dark {
  --background:      30, 10%, 10%;       /* #1C1815 */
  --foreground:      40, 10%, 90%;       /* #E8E0D6 */

  --card:            30, 8%, 16%;        /* #29231E */
  --card-foreground: 40, 10%, 90%;

  --muted:           30, 6%, 20%;        /* #342E28 */
  --muted-foreground: 40, 5%, 60%;

  --border:          30, 6%, 25%;        /* #403A34 */
  --ring:            40, 90%, 50%;

  --secondary:       30, 5%, 22%;        /* #38322C */
  --secondary-foreground: 40, 10%, 90%;

  --primary:         40, 90%, 50%;       /* #E8A817 — original amber, safe in dark */
  --primary-foreground: 40, 10%, 8%;

  /* destructive, success, warning — same as light mode */
}
```

### Why Light and Dark Mode Use Different Primary Values

The original amber `--primary: hsl(40, 90%, 50%)` (#E8A817) — while visually appealing and retained in dark mode — cannot satisfy both of these WCAG 2.2 AA contrast requirements simultaneously in light mode:

1. **`text-primary` on `bg-background` (#F5F0EB)** — small text requires ≥ 4.5:1.  
   For #E8A817 (relative luminance ≈ 0.464) on #F5F0EB (L ≈ 0.877), the ratio is **1.80:1** — far below the threshold. To reach 4.5:1, the primary's luminance must be **≤ 0.156** (roughly 30% HSL lightness at this hue).

2. **`text-primary-foreground` on `bg-primary`** — the foreground must also meet ≥ 4.5:1 against the new darker background. With the original `--primary-foreground: hsl(40, 10%, 8%)` (#16140F, L ≈ 0.006) on a 30%-lightness primary (L ≈ 0.155), the ratio would drop to **3.0:1** — below the small-text threshold.

These are competing constraints: constraint 1 demands darkening the primary, which then forces the foreground toward the opposite end of the luminance scale. A single hex value cannot satisfy both when the background is light (mode 1) and when the same primary acts as a button background (mode 2).

**Solution — mode‑specific tokens:**

| Mode | `--primary` (hex) | `--primary-foreground` (hex) | Rationale |
|---|---|---|---|
| Light | **#8E620B** (L ≈ 0.145) | **#EFEBE3** (L ≈ 0.857) | Dark primary passes 4.5:1 on light bg (4.75:1); light foreground passes 4.5:1 on dark primary (4.65:1) |
| Dark | **#E8A817** (L ≈ 0.464, original amber) | **#16140F** (L ≈ 0.006) | On dark bg (#1C1815, L ≈ 0.020), amber text passes 7.34:1; on amber button bg, dark text passes 9.17:1 |

The amber brand color is preserved in dark mode and in all `bg-primary/10`, `bg-primary/20` tinted-surface uses. It is only the light-mode solid `bg-primary` and `text-primary` tokens that differ — an intentional, mathematically necessary divergence.

> Do not attempt to "fix" this by reverting to a single shared value across modes. A single value cannot satisfy both contrast regimes. The current split is intentional and tested.

### Accent Restraint

The amber (`--primary`) must read as an accent — not a surface color.

- **CTA buttons, brand marks, highlights, focus rings, active states** — these own the amber.
- **Never** use amber as a background for large surface areas (cards, sidebars, full-screen sections). The one exception is the hero section on the landing page, where it may be used sparingly as a directional color block.
- Follow the 70-20-10 rule: ~70% neutral (warm grays/charcoals), ~20% secondary (muted surfaces), ~10% accent (amber, green, red, etc.).
- Dark mode's primary default is the warm background, not the amber. The amber should be even more sparing in Operate mode (in-room) than Persuade mode (landing).

### The Gray Scale (Warm)

All grays carry a warm (amber-based) undertone, replacing the cool grays from SYSTEM.md:

| Token | Light | Dark | Usage |
|---|---|---|---|
| gray-50 | #F7F4EF | — | Page bg |
| gray-100 | #EDE8E0 | — | Card bg |
| gray-200 | #E0D9D0 | — | Borders |
| gray-300 | #CCC3B8 | — | Disabled borders |
| gray-400 | #A69B8E | — | Placeholder, disabled |
| gray-500 | #7D7367 | — | Secondary text |
| gray-600 | #5E564C | — | Body text (dark) |
| gray-700 | #423B33 | — | Headings (dark) |
| gray-800 | #2B2621 | — | Strong heading (dark) |
| gray-900 | #1C1815 | — | Page bg (dark) |

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
- **Color: amber is allowed in slightly larger doses** (as a background accent strip, a hero color block) but never as a dominant surface.

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
  --color-primary: hsl(40 90% 50%);
  --color-primary-foreground: hsl(40 10% 8%);
  --color-background: hsl(40 20% 96%);
  --color-foreground: hsl(30 15% 10%);
  /* ... etc for every semantic token above */
}
```

### Existing Utility Compatibility

- Use the existing `cn()` helper for conditional class merging.
- Use Headless UI components (already in the project) for dialogs, listboxes, menus — do not introduce Radix or another headless library.
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
| **Landing (Welcome)** | Persuade | Hero with Vazirmatn display weight, warm dark section, single CTA. No feature grid. |
| **Dashboard** | Operate | Compact room information cards without poster thumbnails, minimal chrome, dark default. Room list timestamps use Persian digits (e.g. "created ۱۵ تیر ۱۴۰۵") and Persian relative time (e.g. "۳ روز پیش"). |
| **Room Show (in-room)** | Operate | Video ≥70% viewport. Fading overlay controls. Sidebar (chat/members/subtitles tabs). Invite code is displayed with `dir="ltr"` and stays in Latin characters — not converted to Persian digits. |
| **Login / Register** | Persuade | Warm card on off-white. Minimal visual weight. No illustration — just form + brand mark. |
| **Profile** | Operate | Simple inline form. Dark card layout. No avatars, no settings sections yet. |
