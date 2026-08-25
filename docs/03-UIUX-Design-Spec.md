# ProductForge — UI/UX Design Specification

**Version** 2.0 · **Companion to** PRD v2.0 · **Status** Binding

---

## 1. Design thesis

The reference is a learning dashboard: soft, spacious, pastel-card, calm. It works because it treats a dense subject as something pleasant to look at rather than something to endure.

ProductForge shows creators their money. Money interfaces are almost universally cold — Stripe grey, dense tables, charts nobody reads. **Adopting a warm, calm, consumer-grade surface for financial data is the whole aesthetic bet.** A creator opening the app to see they earned $412 this week should feel the way they feel opening a good photo app, not a bank statement.

Everything below serves that. The one place to spend boldness is the arrow chip (§4). Everything else stays quiet.

---

## 2. Tokens

### 2.1 Colour

```css
/* Canvas & surface */
--canvas:        #E7EAE5;   /* page bg + faint organic line texture, 3% opacity */
--surface:       #FFFFFF;
--surface-sunk:  #F4F5F2;

/* Ink */
--ink:           #16181C;
--ink-2:         #5C6268;
--ink-3:         #6B7175;   /* ruling A1: captions on surface/surface-sunk only */

/* Semantic pastels — see 2.2 */
--mint:          #D5E4DA;
--butter:        #F8E5A6;
--blush:         #F6DBE7;
--lilac:         #E1DAF6;
--sky:           #DAE6F4;

/* System */
--positive:      #2F7D5B;
--warning:       #B8791F;
--negative:      #C0453C;
--hairline:      rgba(22,24,28,0.08);
```

### 2.2 Pastels are semantic, not decorative

One hue per domain, held everywhere without exception:

| Token | Domain | Appears on |
|---|---|---|
| `--mint` | Money, earnings, balance | Earned card, payouts, high-converting rows |
| `--butter` | Products, catalogue | Product cards, sales counts, pending review |
| `--blush` | Buyers, audience | Buyer counts, customers, restricted/blocking states |
| `--lilac` | Traffic, attribution | Link cards, source tables |
| `--sky` | Referrals, system | Referral earnings, informational notices |

A creator should identify a card's subject by colour before reading a word. Never pick a pastel for visual variety.

**Attention cards (ruling A1):** on the "Needs your attention" surface, pastel = urgency, not domain — because `--blush` cannot mean both "buyers" and "blocking":

| Tone | Meaning | Examples |
|---|---|---|
| `--butter` | Needs action, not urgent | finish verification, products awaiting review |
| `--blush` | Genuinely blocking | payout failed, product rejected, account restricted |
| `--sky` | Neutral FYI, no action | dispute filed and we're handling it |

Everywhere else, `--blush` keeps meaning buyers.

### 2.3 Type

| Role | Face | Weights | Where |
|---|---|---|---|
| Display | **Bricolage Grotesque** | 700, 800 | Page titles, card headings, hero. `letter-spacing: -0.02em` |
| Body | **General Sans** | 400, 500, 600 | Everything textual |
| Figures | **Space Grotesk** | 500, 700 | Stat numbers, prices, tabular data. `font-variant-numeric: tabular-nums` |

```
display-xl  3.5rem / 1.05    display-l  2.25rem / 1.1
display-m   1.5rem  / 1.2    display-s  1.125rem / 1.3
body        1rem    / 1.55   body-s     0.875rem / 1.5
caption     0.75rem / 1.4    stat       2.5rem  / 1
```

Self-host all three via `next/font`. `font-display: swap`. Preload display and figures only.

### 2.4 Space and shape

```css
--radius-panel: 32px;  --radius-card: 22px;
--radius-chip: 999px;  --radius-field: 14px;  --radius-tile: 12px;

--gap-tight: 12px;  --gap: 20px;  --gap-loose: 32px;  --gap-section: 44px;
```

Spacing scale is 4px-based: `4 8 12 16 20 24 32 44 64`. Nothing between.

### 2.5 Elevation

Exactly two shadows exist in the product:

```css
--shadow-panel: 0 24px 60px rgba(22,24,28,0.06);   /* the floating panel only */
--shadow-lift:  0 8px 24px rgba(22,24,28,0.08);    /* modals, dropdowns only */
```

**Cards have no shadow and no border.** Separation comes from fill colour and gap. This is the discipline that makes the layout feel calm; violating it once makes the whole surface look ordinary.

---

## 3. Layout

### 3.1 Authenticated shell

```
┌────────────────────────────────────────────────────────────────┐
│  canvas — textured, 24px padding                               │
│                                                                │
│  ┌────┐   ┌──────────────────────────────────────────────┐     │
│  │ ⌂  │   │  panel — surface, r32, shadow-panel          │     │
│  │    │   │  ┌────────────────────────────────────────┐  │     │
│  │ ▣  │   │  │ Welcome back 👋      [search]  (avatar)│  │     │
│  │    │   │  └────────────────────────────────────────┘  │     │
│  │ ▤  │   │                                              │     │
│  │    │   │  ┌─ main 2fr ──────────┐  ┌─ rail 1fr ───┐   │     │
│  │ ▥  │   │  │ attention cards     │  │ payout cal   │   │     │
│  │    │   │  │ stat row (3 up)     │  │              │   │     │
│  │ ▸  │   │  │ product rows        │  │ recent       │   │     │
│  │    │   │  │ bundle prompt       │  │ activity     │   │     │
│  │ ⚙  │   │  └─────────────────────┘  └──────────────┘   │     │
│  └────┘   └──────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

- Icon rail is a **separate floating element** on the canvas, not attached to the panel. 72px wide, `--surface`, `--radius-panel`, its own `--shadow-panel`.
- Active rail item: filled `--ink` circle, 44px, white glyph. Inactive: `--ink-3` glyph, no background. Hover: `--surface-sunk` circle.
- Panel max-width 1280px, centred. Main/rail grid gap `--gap-loose`.

### 3.2 Breakpoints

| Width | Behaviour |
|---|---|
| ≥ 1280px | Full shell as above |
| 900–1279px | Panel fluid, rail narrows to 320px |
| 640–899px | Rail content stacks **below** main column, full width |
| < 640px | Icon rail becomes a fixed bottom bar (5 items max: Home, Products, Traffic, Payouts, More). Panel radius drops to 24px, canvas padding to 12px |

Storefront and product pages are **mobile-first** — most visitors arrive from an in-app browser on a phone. Design those at 375px and scale up.

---

## 4. The signature element

**The arrow chip.**

```
 ╭────╮
 │ →  │   32px circle · --surface fill · → glyph in --ink at 14px
 ╰────╯
```

Rules, all of them binding:

1. It is the **only** "open this" affordance on cards. No text links, no chevrons, no "View more", no whole-card click hints.
2. Present on every navigable card. **Absent from every terminal card.** Its presence carries information.
3. Position: bottom-right on cards ≥ 132px tall; top-right on compact cards.
4. Hover: `transform: translate(2px, -2px)` over `160ms cubic-bezier(0.2, 0, 0, 1)`. Nothing else — no scale, no colour change, no shadow.
5. Focus: `2px --ink` outline at `2px` offset. The card itself is the click target; the chip is the affordance.

**Scope (ruling A2):** the chip rule applies to **cards**. Dense list rows with inline actions (e.g. Traffic links with copy/QR/share) are different: the whole row is the link and there is **no chip** — a chip beside inline action buttons makes the eye ask which affordance opens the row.

Under `prefers-reduced-motion`, the transform is instant.

---

## 5. Component library

### 5.1 Stat card

```
┌─────────────────────────┐  132px tall
│ EARNED THIS MONTH       │  caption, --ink-2, letter-spacing 0.04em
│                         │
│ $412.60            ╭──╮ │  stat, Space Grotesk 700
│                    │→ │ │
└────────────────────╰──╯─┘  fill: semantic pastel
```

Optional delta line below the figure: `body-s`, `--positive` or `--negative`, prefixed `+` / `−` (true minus, U+2212, not a hyphen).

### 5.2 Product card

```
┌─────────────────────────┐  fill --butter
│ ┌─────┐        ╭──────╮ │
│ │cover│        │ Live │ │  status chip
│ └─────┘        ╰──────╯ │
│ 30-Day Growth Kit       │  display-s
│ 5 assets · 82 sales     │  body-s, --ink-2
│                    ╭──╮ │
│                    │→ │ │
└────────────────────╰──╯─┘
```

Status chips: `Draft` `--surface-sunk` · `Live` `--mint` · `Under review` `--butter` · `Restricted` `--blush`.

### 5.3 Asset row

Used in the product editor and on the buyer product page.

```
┌───────────────────────────────────────────────┐
│ ┌───┐  30-Day Planner                   ⠿  ✕ │
│ │PDF│  2.4 MB                                │
│ └───┘                                        │
└───────────────────────────────────────────────┘
```

44px format tile, `--radius-tile`, tinted by type: PDF `--blush`, XLSX `--mint`, ZIP `--butter`, IMG `--lilac`, LINK `--sky`. Drag handle and remove appear on hover only; on touch they are always visible.

### 5.4 Progress row

Full-width pastel. Icon circle + eyebrow, caption, `display-s` title, then a 4px bar in `--ink` on `rgba(22,24,28,0.12)`. Arrow chip top-right.

### 5.5 Payout calendar

7-column grid, 32px circular cells. Payout Monday = `--ink` fill, white figure. Days with sales = `--surface-sunk` fill. Outside month = `--ink-3`. Below the grid, two lines: next payout amount and date in `display-s`, then clearing amount in `caption`.

### 5.6 Empty states

Pastel card, one line naming what goes here, one primary action. Never an illustration. Never an apology.

> **No products yet**
> Upload a file or make something new — either takes about two minutes.
> `[ Create product ]`

### 5.7 Money display

- Always `Space Grotesk`, `tabular-nums`.
- Always two decimals in tables, never abbreviated. `$1,240.00` not `$1.2k`. Creators check these against their bank.
- Stat cards may drop cents above $1,000 for scanability: `$4,820`.
- Negative amounts use U+2212 and `--negative`, never parentheses.

---

## 6. Screens

### 6.1 Landing page

```
┌──────────────────────────────────────────────────────────┐
│  ProductForge                          Log in  [Start]   │
├──────────────────────────────────────────────────────────┤
│                              │                           │
│  Sell what you know.         │   ┌───────────────────┐   │
│  Keep 75%.                   │   │ live dashboard    │   │
│                              │   │ miniature @ 0.6×  │   │
│  Make it or upload it, get   │   │ (real components, │   │
│  one link, get paid weekly.  │   │  not a screenshot)│   │
│                              │   └───────────────────┘   │
│  [ Start selling ]           │                           │
├──────────────────────────────────────────────────────────┤
│  WHAT YOU CAN SELL — dense format chips                  │
├──────────────────────────────────────────────────────────┤
│  HOW THE MONEY WORKS — plain table, net-vs-gross stated  │
├──────────────────────────────────────────────────────────┤
│  ONE LINK THAT TELLS YOU WHAT WORKED                     │
│  Reel #34 → 412 clicks → 31 sales → $604                 │
├──────────────────────────────────────────────────────────┤
│  WHAT YOU DON'T HAVE TO DO — two dense columns           │
├──────────────────────────────────────────────────────────┤
│  Invite creators, earn 5% · FAQ · Footer                 │
└──────────────────────────────────────────────────────────┘
```

The hero right side is the thesis: the product **is** the dashboard, so show the real thing rendered from real components. At < 900px it collapses to a single stacked stat card.

One CTA string everywhere: **"Start selling."** No fabricated testimonials or logos.

### 6.2 Creator home

Covered by the shell in §3.1. Notes:

- **Needs your attention** is absent entirely when empty — not an empty state. An empty attention section trains people to ignore the region.
- Stat row is always three cards: Earned (`--mint`), Sales (`--butter`), Buyers (`--blush`).
- Bundle prompt appears at 3+ live products, showing individual total vs. suggested bundle price with one action.

### 6.3 Create product

One screen, two doors, equal visual weight:

```
┌────────────────────────┐  ┌────────────────────────┐
│  --butter              │  │  --lilac               │
│  Upload what you have  │  │  Make something new    │
│  Files you already own │  │  Describe it, we draft │
│                   ╭──╮ │  │                   ╭──╮ │
│                   │→ │ │  │                   │→ │ │
└───────────────────╰──╯─┘  └───────────────────╰──╯─┘
```

**Upload path:** drop zone accepting multiple files at once → asset list → title, description, price, cover → publish. Multi-asset from the first screen; never a single-file flow that gets extended.

**Generate path** — five steps, progress shown as a 4px bar under the header:

1. Three questions: what you know / who you help / what they struggle with.
2. Five **product packages**, each a named bundle with suggested price and asset list. Not five documents.
3. **Outline approval gate.** Nothing generates until the creator approves. Cost control and quality gate.
4. Asset-by-asset editor with regenerate-section.
5. Cover and sales copy, then publish.

The creator never chooses a file format. They describe a product; the system decides.

### 6.4 Traffic — "By content"

The money screen. Highest information density in the product, and the reason people stay.

```
CONTENT              CLICKS   SALES   REVENUE    CONV
Reel — 3 AI tools       412      31    $604.00   7.5%   ← --mint tint
Story — Monday          188      12    $234.00   6.4%
Bio link              2,140      44    $858.00   2.1%
YouTube — tutorial       890       2     $39.00   0.2%   ← --blush tint
Direct                    —      18    $351.00     —
```

Rows above 2× the creator's average conversion get a `--mint` row tint; below 0.3× get `--blush`. No charts. The table *is* the insight.

"Direct" is the honest label for unattributed orders — never fabricate a source.

### 6.5 Payouts

Balance card in `--mint`, three figures each with a one-line plain explanation:

> **Available now** $412.60 — goes out Monday
> **Clearing** $88.20 — available from 12 Nov
> **On hold** $45.00 — released after your first 90 days

"Clearing" MUST always show the date. Never use the word "maturation" in the interface.

### 6.6 Referrals

Stat cards in `--sky`. Table: creator, joined, their sales, platform revenue, your 5%, months left of 12.

Terms stated on the page in plain words, never in a tooltip: *5% of what ProductForge earns from creators you invite, for 12 months. Paid with your normal weekly payout. One level only.*

### 6.7 Storefront — `/@handle`

Mobile-first. Creator avatar, name, bio, socials, featured product, product grid, bundles. Creator picks one accent from the five pastels; it tints the featured card and nothing else.

### 6.8 Product page

Single column, no nav, nothing competing with the buy action.

Cover → title → price → **what's inside** (asset rows with format tiles — this is the entire argument for a bundle) → 3–5 page preview → refund policy in plain words → buy button.

### 6.9 Admin

Same tokens, denser register: `--radius-card: 14px`, `--gap-tight` throughout, tables instead of cards, `body-s` as base. A back office, not a consumer app.

**Review queue** is the most-used screen and must be keyboard-driven: `J`/`K` to move, `A` to clear, `R` to restrict, `X` to remove. Target under 60 seconds per item. If it's slower, the screen is wrong.

---

## 7. Motion

| Interaction | Spec |
|---|---|
| Arrow chip hover | `translate(2px,-2px)`, 160ms, `cubic-bezier(0.2,0,0,1)` |
| Page transition | 200ms opacity only. No slides |
| Card enter | 240ms fade + `translateY(8px)`, 40ms stagger, first paint only |
| Number change | Count-up over 400ms, figures only, once per session |
| Toast | Slide from bottom, 200ms, auto-dismiss 4s |
| Skeleton | `--surface-sunk` shimmer, 1.4s loop |

Nothing else animates. Scattered micro-interactions are the main reason interfaces read as machine-generated. `prefers-reduced-motion: reduce` disables all of the above and count-ups render final values immediately.

---

## 8. Accessibility

Binding on every screen.

- **Contrast:** all text meets WCAG AA. **`--ink-3` is permitted only on `--surface` and `--surface-sunk`; on pastels and canvas `--ink-2` is mandatory** — no lightness of ink-3 passes on pastels, permanently (ruling A1). CI runs `scripts/check-contrast.mjs`: a *permitted-matrix* check (every allowed text/fill pair must pass AA 4.5:1; `--warning` on white at large-text 3:1 only) that additionally asserts the banned ink-3 pairs genuinely fail, so the ban stays true if tokens change.
- **Focus:** `2px --ink` outline, `2px` offset, on every interactive element. Never `outline: none` without a replacement.
- **Targets:** 44×44px minimum. The arrow chip is 32px visually with a 44px hit area.
- **Semantics:** real `<button>` and `<a>`. Cards are `<article>` with the arrow chip as the labelled link. Tables are real `<table>` with `<th scope>`.
- **Live regions:** balance updates and toasts in `aria-live="polite"`. Errors in `aria-live="assertive"`.
- **Keyboard:** every flow completable without a mouse, including publish and the admin review queue.
- **Motion:** `prefers-reduced-motion` respected everywhere.

---

## 9. Voice

Sentence case throughout. Active verbs. An action keeps its name across the whole flow — a "Publish" button produces a "Published" toast, never "Product created successfully."

**Say / don't say:**

| Say | Don't say |
|---|---|
| Your earnings | Revenue share disbursement |
| Clearing until 12 Nov | Funds in maturation window |
| We're checking this product | Pending moderation review |
| Payout account | Connected account |
| Goes out Monday | Scheduled for next payout cycle |

**Errors** state what happened and what to do, in the interface's voice. They don't apologise and they're never vague.

> **This file didn't pass our security scan.** Try re-exporting it from the original app, or upload a different file.

Not: *"Sorry! Something went wrong. Please try again later."*

**Empty screens are invitations.** Name what goes there and give one action.

---

## 10. Implementation notes

- Tokens live in `app/globals.css` as CSS custom properties, mirrored into `tailwind.config.ts`. **One source of truth** — never hardcode a hex in a component.
- Build the component library in isolation first (Storybook or a `/kitchen-sink` route) before any screen. The reference look survives or dies on component consistency.
- The canvas texture is a single tiling SVG at 3% opacity, under 8KB, as a CSS background.
- Dark mode is **out of scope for v1.** The palette is built on light pastels and a naive inversion will look wrong. Do it properly later or not at all.

---

## 11. Rulings from the Phase-1 build (binding, promoted from OPEN-QUESTIONS)

- **Bundle prompt price:** suggest ~70% of the members' individual total, floored to a whole dollar, never below $5. One formula everywhere (`suggestedBundlePrice`).
- **Restricted creators' storefronts** return 404 — "not sellable" means not visible. Their buyers keep `/access`.
- **Traffic row tinting:** the creator's average conversion is computed over *attributed* rows only; "Direct" (no conversion figure) never tints.
- **Progress-bar track** is its own token, `--ink-12` (rgba ink at 12%), because opacity modifiers don't compose with var-backed colours.
- **Spec dimensions are tokens:** stat card 132px, feature card 156px, rail 72px, panel max 1280px, panel radius 24px under 640px, mobile frame 375px — all in `globals.css`, never as arbitrary classes.
- **Arrow-chip motion and skeleton shimmer** live in `globals.css` as component-layer rules so the timing values exist exactly once.
- **`--warning` text** is permitted on `--surface` at large/bold sizes only (AA large-text 3:1); it does not pass for body text anywhere.
