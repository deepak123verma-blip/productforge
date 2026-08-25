# ProductForge — Product Requirements Document

**Version** 2.0 · **Owner** Loom Labs AI LLC · **Status** Ready for build
**Supersedes** v1.0 entirely. Do not reference the previous document.

---

## 0. How to use this document

Written to be handed to Claude Code. Section 3 (Design System) is binding — every screen derives colour, type and spacing from those tokens and introduces no new ones. Section 9 is the data model; the invariants there are enforced in code and covered by tests. Section 11 is the build order; do not build ahead of it.

**MUST** is a hard requirement. **SHOULD** is judgement.

### 0.1 Two decisions made by default

These were left open. I've decided them so the build isn't blocked. Both are cheap to reverse **before Phase 2**, expensive after.

**A. The 75% is of net, not gross.** Stripe processing is deducted before the split. On a $5 sale that is the difference between the model working and not (see 2.3). This MUST be stated plainly in the creator agreement and shown as its own line in every payout statement — creators discovering it later is a trust event.

**B. Publishing is instant; review gates the payout, not the listing.** A creator publishes and sells within seconds. The product enters an async review queue, and funds cannot leave until it clears. The T+14 maturation window already exists, so this costs nothing and removes the bottleneck between creator excitement and the link going in their bio. Full spec in section 7.

---

## 1. Product summary

ProductForge is where a creator runs their entire digital product business: make or upload products, package them, sell them from one link, see which content produced the money, and get paid weekly.

**Positioning: commerce first, AI as a feature.** The headline is *the easiest place to sell digital products*, not *AI makes your product*. A generator is copyable in a weekend. A creator's storefront, catalogue, links, sales history, buyer list, payout ledger and referral earnings are not.

Never lead with "AI." Lead with "You keep 75%."

### 1.1 Locked decisions

| Decision | Value |
|---|---|
| Legal entity | Loom Labs AI LLC (US) |
| Commercial model | **Merchant of Record** — the LLC is the seller; creators licence content and take a revenue share |
| Payments | Stripe (Checkout + Tax + Connect + Radar) |
| Connect config | Express · `service_agreement: recipient` · `capabilities: transfers` only |
| Fund flow | **Separate charges and transfers, WITHOUT `on_behalf_of`** — required for cross-border payout to India |
| Loss liability | Platform (`controller.losses: application`) |
| Revenue share | **Flat 75% creator / 25% platform, on net after processing. No tiers, no exceptions** |
| Minimum price | **$5 USD** |
| Payouts | Weekly, Mondays |
| Maturation | T+14 from purchase |
| New-creator reserve | 10% for first 90 days, released if dispute rate < 0.5% |
| Review | Async, gates payout not publish |
| Referrals | 5% of *platform revenue* from referred creator · **single tier, one level, permanently** · 12 months · no purchase required |
| Currency | USD only in v1 |

### 1.2 Non-goals for v1

Subscriptions and memberships. Video hosting. Physical goods. Multi-currency. Public marketplace browsing. Native apps. **Any second referral tier — architect so it is not possible.**

---

## 2. Core concepts

### 2.1 A product is not a file

This is the central architectural idea. Get it right now; retrofitting it after 200 products carry live money is a three-week migration.

```
Product  "30-Day Instagram Growth Kit"  $29
│
├── Asset  30-Day Planner            file · pdf
├── Asset  100 Reel Hooks            file · pdf
├── Asset  Content Calendar          file · xlsx
├── Asset  Canva Template Pack       link · canva
└── Asset  Bonus Prompt Pack         file · pdf
```

A product has one or more **assets**. The creator thinks in products; the platform handles formats.

### 2.2 Two asset types, and they behave differently

| | `file` | `link` |
|---|---|---|
| Examples | PDF, XLSX, ZIP, CSV, images | Canva, Notion, Google Sheets share URLs |
| Delivery | Signed URL, 24h expiry | Redirect through a tracked gateway |
| **Delivery evidence** | Download event with IP + UA | **Weaker — gateway click only** |
| Revocable after refund | Effectively yes | **No** |
| Malware scanning | Yes | N/A — URL reputation only |

**Consequence, and it MUST be built in:** orders containing only `link` assets have materially weaker chargeback evidence. Flag them in the disputes queue, weight them higher in creator risk scoring, and **exclude link-only products from a new creator's first three products.**

### 2.3 Money on a $5 sale

Worked so the split logic is unambiguous:

```
Buyer pays                       $5.00   (500¢)
Stripe Tax (added at checkout)   passed through, not revenue
Stripe processing (2.9% + $0.30) $0.45   (45¢ — Stripe reports whole cents)
─────────────────────────────────────
Net                              $4.55   (455¢)
Creator 75% (floor)              $3.41   (341¢)
Platform 25% (remainder)         $1.14   (114¢)
```

*(Corrected per ruling A3: all arithmetic is integer cents; the algorithm `creator = floor(net × 0.75)`, `platform = net − creator` is binding.)*

**Why net, not gross:** at gross, a $5 sale pays the creator $3.75 and leaves the platform $0.805 after processing — a 16% effective take, before refunds, storage, generation and support. The model inverts at low ticket. Deducting processing first keeps the split honest at every price point.

### 2.4 The low-ticket risk, stated plainly

$5 is allowed because it expands the product universe. But Stripe's dispute ceiling is counted in **transactions, not dollars**, and low-ticket impulse digital goods are the highest-dispute category that exists.

| | $5 product | $29 product |
|---|---|---|
| Sales per $100 platform revenue | ~88 | ~15 |
| Sales wiped out by one dispute | ~18 | ~7 |

Guardrails, all required (see section 8): descriptor discipline, per-creator and per-price-band dispute tracking, auto-restriction of sub-$9 publishing above 0.5% dispute rate, and bundles surfaced aggressively in the UI so $5 is an entry point rather than the business.

### 2.5 Bundles

A bundle is a product whose assets are drawn from the creator's other products. It sells as a single order against a single product row — no split attribution, no partial refunds.

The dashboard MUST prompt for bundles once a creator has 3+ live products, showing individual total vs. suggested bundle price. Raising AOV is the primary defence against the transaction-count problem above.

---

## 3. Design system

Direction taken from the supplied reference: soft, spacious, pastel-card, calm. Deliberately not a SaaS dashboard — closer to a well-made consumer app.

### 3.1 Colour tokens

```css
--canvas:        #E7EAE5;   /* page bg, faint organic line texture */
--surface:       #FFFFFF;   /* floating panel and all cards */
--surface-sunk:  #F4F5F2;   /* fields, inactive states */

--ink:           #16181C;   /* headings, primary text, active pill */
--ink-2:         #5C6268;   /* secondary */
--ink-3:         #9AA0A4;   /* tertiary, captions */

--mint:          #D5E4DA;   /* money and earnings */
--butter:        #F8E5A6;   /* products */
--blush:         #F6DBE7;   /* buyers and audience */
--lilac:         #E1DAF6;   /* traffic and attribution */
--sky:           #DAE6F4;   /* referrals and system */

--positive:      #2F7D5B;
--warning:       #B8791F;
--negative:      #C0453C;
--hairline:      rgba(22,24,28,0.08);
```

**Pastels are semantic, not decorative.** One hue per domain, held everywhere. A creator should identify a card's subject by colour before reading it.

### 3.2 Typography

Three roles. Do not substitute Inter or system-ui.

| Role | Face | Source | Usage |
|---|---|---|---|
| Display | **Bricolage Grotesque** 700–800 | Google Fonts (variable) | Titles, card headings, hero. Tracking `-0.02em` |
| Body | **General Sans** 400/500/600 | Fontshare | Body, labels, buttons, tables |
| Figures | **Space Grotesk** 500/700 | Google Fonts | Stat numbers, prices, tabular data. `tabular-nums` |

```
display-xl 3.5    display-l 2.25   display-m 1.5    display-s 1.125
body 1.0          body-s 0.875     caption 0.75     stat 2.5
```

### 3.3 Shape and layout

```css
--radius-panel: 32px;  --radius-card: 22px;
--radius-chip: 999px;  --radius-field: 14px;
--gap-tight: 12px; --gap: 20px; --gap-loose: 32px; --gap-section: 44px;
```

```
┌──────────────────────────────────────────────────────┐
│ canvas (textured)                                    │
│ ┌──┐ ┌──────────────────────────────────────────┐    │
│ │ic│ │ surface panel, r32                       │    │
│ │on│ │ ┌ header: title ── search ── avatar ───┐ │    │
│ │  │ │ └──────────────────────────────────────┘ │    │
│ │ra│ │ ┌ main (2fr) ────────┐ ┌ rail (1fr) ──┐  │    │
│ │il│ │ │ cards / stats      │ │ calendar     │  │    │
│ └──┘ │ └────────────────────┘ └──────────────┘  │    │
│      └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

- Icon rail floats separately on the canvas, ~72px. Active item is a filled `--ink` circle with white glyph.
- Panel: no border. `box-shadow: 0 24px 60px rgba(22,24,28,0.06)`.
- Cards: **no borders, no shadows.** Separation is fill colour and gap alone.

### 3.4 Signature element

**The arrow chip.** 32px circle, `--surface` fill, `→` in `--ink`, bottom-right of every navigable card.

The product's only "open this" affordance. No text links, no chevrons, no "View more" on cards. Present on navigable cards, absent from terminal ones. Hover: translate `2px, -2px` over `160ms ease-out` and nothing else. Spend the boldness here; everything else stays quiet.

### 3.5 Components

| Component | Spec |
|---|---|
| **Stat card** | Pastel fill, `caption` label, `stat` figure, arrow chip. Height 132px |
| **Feature card** | Pastel fill, thumbnail or avatar stack, status chip top-right, `display-s` title, arrow chip. Height 156px |
| **Progress row** | Full-width pastel. Icon circle + eyebrow, caption, `display-s` title, 4px progress bar in `--ink`. Arrow chip top-right |
| **Asset row** | `--surface-sunk`. Format tile (44px rounded square, format glyph), filename, size or domain, drag handle, remove |
| **List row** | `--surface-sunk`, 44px icon tile, two-line label |
| **Status chip** | Pill. Draft `--surface-sunk` · Live `--mint` · Under review `--butter` · Restricted `--blush` |
| **Calendar** | 7-col, 32px circular cells. Payout day = `--ink` fill |
| **Button primary** | `--ink` fill, white text, `--radius-chip`, 44px |
| **Empty state** | Pastel card, one line explaining what goes here, one action. No illustration, no apology |

### 3.6 Quality floor

Non-negotiable on every screen. Responsive to 375px (below 900px rail stacks under main; below 640px icon rail becomes a bottom bar). Visible keyboard focus, `2px --ink` outline at `2px` offset. `prefers-reduced-motion` respected. WCAG AA on all text — **`--ink-3` fails on pastels; use `--ink-2` on pastel fills.** Loading states are `--surface-sunk` skeletons, never spinners.

### 3.7 Voice

Sentence case. Active verbs. An action keeps its name through the flow — "Publish" produces "Published." Errors say what happened and what to do, and never apologise. Empty screens invite.

Say "earnings," not "revenue share disbursement." Say "your cut," not "creator allocation." Never leak internals: no "connected account," no "webhook," no "merchant of record," no "maturation."

---

## 4. Landing page

Public, single page. One job: get a creator to publish their first product.

1. **Hero.** `display-xl` headline, one supporting line, one CTA: **"Start selling."** Right side: a live miniature of the creator dashboard built from real component code at 0.6 scale — not an image. The product *is* the dashboard; show it.
2. **What you can sell.** Format chips — guides, planners, checklists, templates, spreadsheets, prompt packs, swipe files, bundles. Volume is the argument; keep them small and dense.
3. **How the money works.** Plain table: you keep 75%, weekly payouts, no monthly fee, $5 minimum, processing deducted before the split. **State the net-vs-gross rule here.** Radical transparency is the differentiator — every competitor buries this.
4. **One link, and it tells you what worked.** The attribution card: `Reel #34 → 412 clicks → 31 sales → $604`. Nobody else has this. Give it its own section.
5. **What you don't have to do.** Two dense columns: checkout, taxes, VAT, hosting, delivery, receipts, refunds, fraud, buyer support.
6. **Invite creators, earn 5%.** Short. Never the headline.
7. **FAQ.** Payouts, supported countries, refunds, product ownership, disputes.
8. **Footer.** Terms, creator agreement, refund policy, privacy, contact — all MUST be real linked pages before launch. Stripe reviews them.

No fabricated testimonials or logos. One CTA string used everywhere. Under 400KB excluding fonts.

---

## 5. Creator dashboard

Rail: **Home · Products · Sales · Traffic · Customers · Payouts · Referrals · Settings.**

The dashboard answers five questions and nothing else: *How much did I make? What sold? Where did buyers come from? What should I make next? How do I make more?*

### 5.1 Home

Header: `Welcome back 👋` in `display-l`, search, avatar menu.

**Main column**
- **Needs your attention (N)** — feature cards, only when action is required: finish verification, payout failed, product restricted, dispute filed. Absent entirely when nothing is pending — not an empty state.
- **This month** — three stat cards: **Earned** (`--mint`), **Sales** (`--butter`), **Buyers** (`--blush`).
- **Your products** — progress rows. Eyebrow = format mix. Caption = lifetime sales and revenue. Bar = share of this month's revenue.
- **Bundle prompt** — appears at 3+ live products. Shows individual total vs. suggested bundle price with one action.

**Right rail**
- **Payout calendar** — next Monday filled `--ink`, days with sales in `--surface-sunk`. Below: "Next payout — $412.60 on Mon 3 Nov" and caption "$88.20 still clearing."
- **Recent activity** — last 8 events: sales, refunds, products live, payouts, referral earnings.

### 5.2 Products

Grid of feature cards: cover, title, price, status chip, asset count, lifetime sales.

**Create product** — one screen, two doors:

**Upload what you have**
Drag files → set title, description, price, cover → add more assets → publish. Multi-asset from the first screen; never a single-file flow that gets extended later.

**Make something new**
1. What do you know? / Who do you help? / What do they struggle with?
2. Five **product packages** with suggested prices — each a named bundle of assets, not a document. *"30-Day Home Fitness Kit — $19 — workout plan (PDF), progress tracker (spreadsheet), meal worksheet (PDF), grocery checklist (PDF)."*
3. Creator picks one. **Outline shown for approval before generation runs** — cost control and quality gate.
4. Assets generated. Section-level editor per asset.
5. Cover and sales copy generated.
6. Publish.

**V1 generation produces PDF assets only.** Spreadsheet generation breaks formulas silently and a broken tracker is a refund. Non-PDF assets are uploaded by the creator into the same bundle. The creator never picks a file format — they describe a product, the system decides.

**Bundle builder** — pick existing products, set bundle price, publish. Assets are referenced, not copied.

### 5.3 Sales

Table: date, product, buyer email masked (`r••••@gmail.com`), gross, processing, platform fee, your earnings, status, source. Filter by date, product, source, status. CSV export. Row expands to the full order ledger including refunds and disputes.

### 5.4 Traffic

The stickiness surface.

- **Links** — one tracked link per piece of content. Label ("Reel — 3 AI tools"), destination, short URL, QR, copy button.
- **Revenue by source** — source, visits, checkouts started, sales, revenue, conversion.
- **By content** — the money screen. `412 clicks → 31 sales → $604 → 7.5%`. Rows converting above 2× the creator's average tinted `--mint`; below 0.3× tinted `--blush`.

### 5.5 Customers

List: email, first purchase, purchases, lifetime value, products owned. Powers the cross-sell insight later. No messaging in v1.

### 5.6 Payouts

- **Balance card** (`--mint`): Available now / Clearing / On hold. Each with a one-line plain explanation. The clearing figure MUST show the date it becomes available.
- **History** — downloadable statement per payout: gross, processing, platform fee, refunds clawed, disputes clawed, referral earnings, reserve held, reserve released, net. Reconstructable to the cent.
- **Bank details** — link out to Stripe-hosted Express management. Do not build a bank form.

### 5.7 Referrals

- **Your link** — `productforge.com/r/{handle}`, copy button, share sheet.
- **Stat cards**: total referral earnings (`--sky`), referred creators, active creators, this month.
- **Table**: creator, joined, their sales, platform revenue, your 5%, months remaining of 12.
- **Terms, stated on the page:** 5% of ProductForge's platform revenue from creators you refer, for 12 months from their signup. Paid with your normal weekly payout. One level only.

### 5.8 Settings

Profile, storefront handle and branding, payout account status, tax forms (W-9 / W-8BEN via Stripe), notifications, delete account.

---

## 6. Buyer-facing surfaces

Minimal by design. The buyer is the customer, not the user. **No buyer dashboard.**

### 6.1 Storefront — `/@handle`

The link-in-bio. Creator avatar, name, bio, social links, featured product, product grid, bundles. Uses the same tokens with a creator-selected accent from the pastel set. Mobile-first — most visitors arrive from an in-app browser.

Every product also has its own URL: `/@handle/product-slug`.

### 6.2 Product page

Cover, title, price in Space Grotesk, **what's inside** (the asset list, with format tiles — this is the whole argument for a bundle), preview of 3–5 pages, refund policy in plain words, buy button. Single column, no nav, nothing competing with the buy action.

### 6.3 Checkout

Stripe Checkout, hosted. Never a custom card form. Stripe Tax at buyer location.

### 6.4 Delivery and re-access

Success page with immediate access to every asset, plus email with a signed link.

**Keep one magic-link access page at `/access`** — not a dashboard, a receipt. Required for three unglamorous reasons: signed URLs expire and without re-access every expiry becomes your support ticket; version updates need somewhere to live; and download history is the evidence that wins disputes.

**Every delivery event MUST be logged** — `order_id`, type, timestamp, hashed IP, user agent. Its absence is a named Stripe risk signal.

### 6.5 Version updates

When a creator publishes a new version, every past buyer gets an email with the changelog and a fresh access link. Cheapest retention mechanic in the product.

### 6.6 Refunds

Self-service, 14 days, one click, no questions. A refund costs $5. A chargeback costs $15 plus a rate you cannot unwind. Refunding MUST be strictly easier than disputing.

---

## 7. Safety and review

Publishing is instant. Money is gated.

### 7.1 At publish — automated, synchronous, under 10 seconds

| Check | Method | Fail action |
|---|---|---|
| Malware | VirusTotal on every uploaded file (hash-first) | Block publish |
| File integrity | Type, size, structure, password-protection | Block publish |
| URL reputation | For `link` assets | Block publish |
| Prohibited content | LLM classifier on title, description, extracted text | Block publish |
| Risk claims | Income, medical, legal guarantees | Flag, publish anyway |
| Duplicate detection | Perceptual hash against existing catalogue | Flag, publish anyway |

Pass → live in seconds, sellable immediately.

### 7.2 After publish — human review, asynchronous, gates payout

Copyright and piracy are **not** detectable automatically. Nothing you can build catches a repackaged PLR ebook or a pirated guide — and it sells through your Stripe account.

So: the product is live and selling while a human reviews it. Funds from that product cannot enter a payout until review clears. The T+14 window already exists, so this is free.

**Risk tiering — required, or you drown:**

| Tier | Condition | Review |
|---|---|---|
| **Full** | Creator's first 3 products, or any flagged check | Human, before first payout |
| **Spot** | Established creator, clean history | 1 in 10, sampled |
| **Auto** | 5+ cleared products, zero disputes, 90+ days | Post-hoc only |

**Target: under 60 seconds per item.** If review takes longer than that, the queue screen is wrong, not the policy.

### 7.3 Creator risk scoring

Rolling per-creator: dispute rate 30/60/90d, refund rate, link-only order share, price-band mix, referral-cluster signals.

Automatic actions: above 0.5% dispute rate → sub-$9 publishing restricted, reserve raised to 20%. Above 1% → payouts paused pending review. New products from restricted creators → full review regardless of tier.

---

## 8. Referral programme

### 8.1 Rules

- 5% of **ProductForge's platform revenue** from the referred creator — not 5% of their sales. On a $1,000 seller: creator $750, platform $250, referrer $12.50.
- **Single tier. One level. Permanently.** A referral's referral earns nothing, ever. Architect so tier 2 is not representable in the schema.
- 12 months from the referred creator's signup.
- No purchase or subscription required to participate.
- Paid in the referrer's normal weekly payout, subject to the same maturation and clawback rules.

### 8.2 Fraud controls — required at launch, not later

The attack is obvious: second account, self-refer, buy your own product on your own card, collect 75% + 5%, chargeback.

- Device and IP fingerprint at signup; cluster detection across referrer/referee.
- Payout bank account and tax identity matching — same account on both sides blocks the referral.
- Referral earnings mature **after** the referee's own earnings mature, never before.
- Minimum referee GMV of $100 before any referral earnings unlock.
- Buyer-card-matches-creator-card detection on the referee's own sales.
- Referral earnings clawed back proportionally on every refund and dispute.

### 8.3 Ledger consequence

A referral is a **second claim on the same order**. When an order refunds or disputes you claw back the creator's share *and* the referrer's — and the referrer may already have been paid.

Every referral-eligible order MUST write a paired ledger entry at the same moment as the creator's. Never derive referral earnings by aggregating later; the two must be created and reversed atomically. **This is where subtle money bugs live.**

---

## 9. Data model

```
users              id, email, name, avatar_url, is_creator, is_admin, created_at

creators           user_id, handle, display_name, bio, accent_token, socials_json,
                   stripe_account_id, country, kyc_status, reserve_pct, reserve_until,
                   payouts_paused, review_tier('full'|'spot'|'auto'),
                   dispute_rate_30d, dispute_rate_90d, min_price_cents,
                   referred_by_creator_id, referral_expires_at

products           id, creator_id, title, slug, description, kind('single'|'bundle'),
                   origin('generated'|'uploaded'|'mixed'), price_cents, cover_key,
                   status('draft'|'live'|'restricted'|'removed'),
                   review_state('pending'|'cleared'|'rejected'), review_note,
                   current_version_id, created_at, published_at

product_versions   id, product_id, version, changelog, published_at

assets             id, product_version_id, position, kind('file'|'link'),
                   title, format, file_key, file_size, external_url, link_provider

bundle_items       bundle_product_id, member_product_id, position

orders             id, buyer_id, product_id, product_version_id, creator_id,
                   gross_cents, tax_cents, processing_cents, net_cents,
                   platform_cents, creator_cents,
                   stripe_payment_intent_id, source_link_id, has_link_assets,
                   matures_at, state('paid'|'refunded'|'disputed'|'reversed'), created_at

delivery_events    id, order_id, asset_id, type('download'|'link_open'|'email_sent'|
                   'email_opened'|'access_link_used'), ts, ip_hash, user_agent
                   -- append-only, never deleted, this is dispute evidence

ledger_entries     id, creator_id, order_id, referral_of_creator_id,
                   type('sale'|'refund'|'dispute'|'referral'|'referral_reversal'|
                        'reserve_hold'|'reserve_release'|'payout'|'adjustment'),
                   amount_cents, ts, memo
                   -- append-only, single source of truth for all money

payouts            id, creator_id, period_start, period_end, sales_cents,
                   referral_cents, clawed_cents, reserve_held_cents,
                   reserve_released_cents, net_cents, stripe_transfer_id,
                   state('pending'|'sent'|'failed'), sent_at

links              id, creator_id, product_id, label, slug, created_at
link_events        id, link_id, ts, ip_hash, user_agent, referrer

safety_checks      id, product_version_id, check_type, result, detail_json, ts
reviews            id, product_id, reviewer_id, outcome, note, ts

disputes           id, order_id, stripe_dispute_id, reason, amount_cents,
                   state, evidence_submitted_at, outcome, resolved_at
```

### 9.1 Invariants — enforce in code, cover with tests

1. `ledger_entries` is append-only. Corrections are new entries, never mutations.
2. Balance is always `SUM(ledger_entries)` for a creator. Never a stored column.
3. `payouts` derive from the ledger, never the reverse.
4. An order cannot enter a payout before `matures_at` **or** while its product's `review_state` is `pending`.
5. A `referral` entry MUST be written in the same transaction as its parent `sale`, and reversed in the same transaction as any refund or dispute.
6. `creators.referred_by_creator_id` is set once at signup and is immutable. **A creator whose own `referred_by` is set generates no upstream earnings for their referrer's referrer** — enforce in the write path, not just by convention.
7. All money is integer cents. No floats anywhere, including the UI layer.

---

## 10. Integrations

| Service | Use | Notes |
|---|---|---|
| Stripe Checkout | Buyer payment | Hosted, never custom |
| Stripe Tax | Calculation | Calculation only; registration and filing are manual |
| Stripe Connect Express | Onboarding, payouts | `recipient` + `transfers` |
| Stripe Radar | Fraud | Tuned before launch |
| Supabase | Postgres, auth, storage | RLS on every table |
| VirusTotal | Malware | Every uploaded file, no exceptions; hash-first, upload-second |
| Resend | Email | Receipts, delivery, version updates, payouts |
| Anthropic API | Generation | Server-side only |

**Webhooks:** `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `transfer.failed`, `account.updated`. All idempotent by Stripe event ID.

---

## 11. Build order

| Phase | Weeks | Scope | Done when |
|---|---|---|---|
| **0 · Foundation** | 1–2 | Stripe account with accurate business description, Tax on, Connect onboarding, legal pages, design tokens, component library | A creator completes KYC and reaches verified |
| **1 · Products** | 3–6 | Multi-asset upload, bundles, storefront, product page, safety pipeline | A 5-asset product publishes in under 10s and renders on a storefront |
| **2 · Commerce** | 7–9 | Checkout, tax, delivery, delivery evidence, `/access`, refunds, version updates | You buy your own product end to end and see the evidence log |
| **3 · Money** | 10–12 | Ledger, maturation, reserve, weekly payout job, clawbacks, payouts screen, admin payout run | A real payout lands in a real bank account and reconciles to the cent |
| **4 · Attribution** | 13–14 | Tracked links, click capture, order matching, Traffic screen | A test link's clicks and sales reconcile |
| **5 · Referrals** | 15–16 | Referral links, paired ledger entries, fraud controls, referrals screen | A referral earns, then a refund correctly claws it back |
| **6 · Generation** | 17–19 | Guided package generation, outline gate, asset editor, cover, sales copy | A generated multi-asset product passes review and sells |
| **7 · Intelligence** | Month 5+ | Cross-sell pairs, price flags, what-to-make-next from real conversion data | — |

Landing page is built alongside Phase 2 so it can be tested before the product is finished. Admin review queue is required before Phase 1 ships — instant publishing without a review queue is not a launchable state.

**Sequencing note:** money before referrals before generation. Generation is the exciting part and it is last on purpose. A ledger bug found after 200 creators have earnings is a categorically different problem from one found after two.

---

## 12. Admin panel

`/admin`, role-gated. Same tokens, denser register — `14px` radii, tighter gaps, tables over cards. A back office, not a consumer app.

| Screen | Contents |
|---|---|
| **Review queue** | Most-used screen. Product, creator, tier, all assets previewed inline, safety check results. Clear / Restrict with reason / Remove. Keyboard-driven. Target under 60s per item |
| **Creators** | KYC status, lifetime GMV, dispute rate, review tier, reserve, referrer. Actions: pause payouts, adjust reserve, change tier, set min price |
| **Orders** | Global search, manual refund, dispute evidence bundle |
| **Disputes** | Open disputes, deadline countdown, evidence status. **Sorted by deadline ascending, always.** Link-only orders flagged |
| **Payout runs** | Weekly preview before execution — totals, per-creator breakdown, blocked-by-review list, failures. **A human MUST confirm before transfers fire** |
| **Referral integrity** | Referrer/referee clusters, shared fingerprints, matching bank identities, unusual velocity |
| **Money health** | Platform balance, reserves, negative-balance creators, rolling dispute rate 30/60/90d, dispute rate by price band. Banner in `--negative` above 0.75% |
| **Tax** | Nexus tracker per jurisdiction from Stripe Tax, registrations coming due |

---

## 13. Launch gates

- [ ] Terms, creator agreement (with net-vs-gross split and referral terms), refund and privacy pages live and lawyer-reviewed
- [ ] Stripe business description matches what the product does
- [ ] Malware scanning verified on a real infected test file
- [ ] Review queue operable at under 60s per item
- [ ] Delivery evidence verified on a real purchase, both asset types
- [ ] A real payout landed in a real bank account
- [ ] Refund flow tested by someone who is not you
- [ ] Statement descriptor confirmed on a live card charge
- [ ] Radar rules configured
- [ ] Referral clawback tested end to end: earn, then refund, then verify reversal
- [ ] Accessibility pass at 375px, keyboard only

---

## 14. Success and kill criteria

**Success at 90 days:** 25+ creators with 3 or more sales each. Dispute rate under 0.5%. At least one creator earning over $500/month. At least 20% of new creators arriving via referral.

**Kill criteria — set now, before attachment:** fewer than 25 creators with 3+ sales at 90 days, **or** dispute rate above 0.75% at any point. If either fires, stop and reassess rather than pushing through.
