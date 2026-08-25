---
name: design-system
description: Apply on any UI work — components, screens, styles, layout, anything in app/** or components/**. Binding tokens, component specs, motion, and accessibility rules.
---

# Design system

Full spec: `docs/03-UIUX-Design-Spec.md`. Tokens live in `app/globals.css` — never hardcode a hex or an off-scale px value.

## Tokens

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--canvas` | #E7EAE5 | | `--mint` | #D5E4DA |
| `--surface` | #FFFFFF | | `--butter` | #F8E5A6 |
| `--surface-sunk` | #F4F5F2 | | `--blush` | #F6DBE7 |
| `--ink` | #16181C | | `--lilac` | #E1DAF6 |
| `--ink-2` | #5C6268 | | `--sky` | #DAE6F4 |
| `--ink-3` | #6B7175 | | `--positive` | #2F7D5B |
| `--hairline` | rgba(22,24,28,0.08) | | `--warning` | #B8791F |
| | | | `--negative` | #C0453C |

Radii: panel 32 · card 22 · chip 999 · field 14 · tile 12. Gaps: tight 12 · gap 20 · loose 32 · section 44. Spacing scale: 4 8 12 16 20 24 32 44 64 — nothing between.

Type: Bricolage Grotesque (display, 700/800, −0.02em) · General Sans (body, 400/500/600) · Space Grotesk (figures, 500/700, `tabular-nums`). Scale: display-xl 3.5 / display-l 2.25 / display-m 1.5 / display-s 1.125 / body 1 / body-s 0.875 / caption 0.75 / stat 2.5 rem.

## Semantic pastels — never for variety

mint = money/earnings · butter = products · blush = buyers/audience · lilac = traffic/attribution · sky = referrals/system.

**Attention cards only (ruling A1):** pastel = urgency there, not domain — butter = needs action (not urgent) · blush = genuinely blocking · sky = neutral FYI. Everywhere else blush stays "buyers".

**Arrow-chip scope (ruling A2):** cards only. Dense list rows with inline actions: whole row is the link, NO chip.

## The arrow chip — five binding rules

1. The **only** "open this" affordance on cards. No text links, chevrons, or "View more".
2. Present on every navigable card, absent from every terminal card — presence carries information.
3. Bottom-right on cards ≥ 132px tall; top-right on compact cards.
4. Hover: `translate(2px,-2px)`, 160ms `cubic-bezier(0.2,0,0,1)`. Nothing else.
5. Focus: 2px `--ink` outline at 2px offset. 32px visual, 44px hit area.

## Component specs

- **StatCard** — pastel fill, caption label (`--ink-2`, 0.04em tracking), stat figure in Space Grotesk 700, arrow chip. 132px tall. Delta line uses U+2212 for minus.
- **ProductCard** — pastel fill (`--butter`), cover thumb, status chip top-right, `display-s` title, `body-s --ink-2` meta, arrow chip. 156px.
- **AssetRow** — `--surface-sunk`, 44px format tile (`--radius-tile`) tinted PDF `--blush` / XLSX `--mint` / ZIP `--butter` / IMG `--lilac` / LINK `--sky`; drag handle + remove on hover (always visible on touch).
- **StatusChip** — pill: Draft `--surface-sunk` · Live `--mint` · Under review `--butter` · Restricted `--blush`.
- **PayoutCalendar** — 7-col, 32px circular cells; payout Monday `--ink` fill white figure; sale days `--surface-sunk`; outside month `--ink-3`. Below: next payout in `display-s`, clearing amount in `caption` with its date.

## Two shadows only

`--shadow-panel` (floating panel + icon rail) and `--shadow-lift` (modals, dropdowns). **Cards have no shadow and no border** — separation is fill and gap.

## Breakpoints

≥1280 full shell · 900–1279 rail 320px · 640–899 rail stacks below main · <640 icon rail becomes bottom bar (5 items), panel radius 24, canvas padding 12. Storefront/product pages design at 375px first.

## Motion — nothing else animates

Arrow chip hover 160ms · page transitions 200ms opacity only · card enter 240ms fade + 8px rise, 40ms stagger, first paint only · count-up 400ms once per session · toast 200ms, 4s dismiss · skeleton shimmer 1.4s. `prefers-reduced-motion` disables all of it.

## Accessibility floor

WCAG AA everywhere — **HARD RULE (ruling A1): `--ink-3` only on `--surface` / `--surface-sunk`; on pastels and canvas use `--ink-2`. No lightness of ink-3 will ever pass on pastels — permanent constraint, not a bug.** Focus: 2px `--ink` outline, 2px offset, never removed without replacement. Targets ≥ 44×44. Real `<button>`/`<a>`/`<table>`; cards are `<article>` with the chip as labelled link. `aria-live="polite"` for balances/toasts, `assertive` for errors. Every flow keyboard-completable. Loading is `--surface-sunk` skeletons, never spinners.

---

**Build in `/kitchen-sink` before using in a screen.**
