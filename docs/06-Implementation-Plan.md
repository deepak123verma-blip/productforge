# ProductForge — Implementation Plan

**Version** 2.0 · **19 weeks to generation shipping** · Solo build

---

## Principle

**Money before growth before magic.** Generation is the exciting part and it is last on purpose. A ledger bug found after 200 creators have earnings is a categorically different problem from one found after two.

Each phase has a single **exit test** — a thing that either works or doesn't. Don't advance on "mostly done."

---

## Phase 0 · Foundation — Weeks 1–2

| # | Task | Notes |
|---|---|---|
| 0.1 | Stripe account, business description **"digital content marketplace"** | Never write "AI ebook generator" — it reads as a restricted category |
| 0.2 | Stripe Tax enabled; nexus monitoring on | Calculation only; registration is manual and yours |
| 0.3 | Connect Express: `recipient` agreement, `transfers` capability | Not `card_payments`. Locked in PRD §1.1 |
| 0.4 | Supabase project, schema migration, **28 smoke tests in CI** | `04-schema-smoke-tests.sql`, runs on every migration |
| 0.5 | Next.js 15 + Supabase Auth (magic link) | |
| 0.6 | Design tokens in `globals.css` + `tailwind.config.ts` | One source of truth. No hardcoded hex, ever |
| 0.7 | Component library at `/kitchen-sink` | Build in isolation before any screen |
| 0.8 | Legal pages: terms, creator agreement, refund, privacy | **Creator agreement MUST state the net-vs-gross split and referral terms.** Lawyer-reviewed |
| 0.9 | Sentry, PostHog, Better Stack | |

**Exit test:** a creator signs up, claims a handle, completes Connect KYC, and reaches `verified`. The 28 smoke tests pass in CI.

**Do not skip 0.7.** The reference aesthetic survives or dies on component consistency. Building screens first guarantees drift.

---

## Phase 1 · Products — Weeks 3–6

| # | Task | Notes |
|---|---|---|
| 1.1 | Multi-asset upload: parallel, resumable, progress per file | Multi-asset from day one — never a single-file flow to extend later |
| 1.2 | Safety pipeline as a Vercel function | VirusTotal (hash-first) + magic bytes + archive inspection |
| 1.3 | Prohibited-content classifier (Claude Haiku) | Title, description, extracted text |
| 1.4 | Duplicate detection: pHash on covers, simhash on text | Flag only, never block |
| 1.5 | Product editor: assets, reorder, title, price, cover | Price floor read from `creators.min_price_cents` |
| 1.6 | Link assets with provider detection | Canva, Notion, Google. Gateway route, not direct |
| 1.7 | Bundle builder | References members, never copies assets |
| 1.8 | Storefront `/@handle` — mobile-first, ISR | Real traffic lands here. Static-render it |
| 1.9 | Product page `/@handle/[slug]` | "What's inside" asset list is the bundle argument |
| 1.10 | **Admin review queue, keyboard-driven** | Required before Phase 1 ships. Instant publishing without a queue is not launchable |

**Exit test:** a five-asset product with mixed PDF, XLSX and a Canva link publishes in under 10 seconds, renders correctly on a storefront at 375px, and appears in the admin review queue.

---

## Phase 2 · Commerce — Weeks 7–9

| # | Task | Notes |
|---|---|---|
| 2.1 | Stripe Checkout with Tax; metadata carries `source_link_id` | Hosted. Never a custom card form |
| 2.2 | Webhook handler + `processed_events` idempotency table | Ack first, queue the work |
| 2.3 | Order creation at `checkout.session.completed` | Fees pending at this point |
| 2.4 | Signed-token delivery, both asset types | 24h TTL, revocable `jti` |
| 2.5 | **`delivery_events` logging on every access** | This is your chargeback defence. No exceptions |
| 2.6 | Buyer email: receipt + all asset links (React Email) | |
| 2.7 | `/access` magic-link re-access page | Not a dashboard. A receipt |
| 2.8 | Self-service refunds, 14 days, one click | Must be easier than disputing |
| 2.9 | Version publishing + changelog email to past buyers | Cheapest retention mechanic in the product |
| 2.10 | Landing page | Built now so it can be tested before the product is finished |

**Exit test:** you buy your own product end to end on a live card, receive every asset, see the complete delivery evidence log, and refund it successfully.

---

## Phase 3 · Money — Weeks 10–12

**The highest-risk phase. Do not rush it.**

| # | Task | Notes |
|---|---|---|
| 3.1 | Split calculation from the **balance transaction**, not estimated | `charge.succeeded`, not session completion |
| 3.2 | Ledger writes: `sale` + paired `referral`, atomic | One transaction or neither |
| 3.3 | Maturation clock: `matures_at = created_at + 14d` | |
| 3.4 | `payable_orders` view enforcement | Matured **AND** review cleared |
| 3.5 | Reserve: 10% for 90 days, auto-release under 0.5% disputes | |
| 3.6 | Refund and dispute clawbacks, both entries reversed atomically | |
| 3.7 | Dispute evidence auto-assembly from `delivery_events` | |
| 3.8 | Weekly payout runner with advisory locks | |
| 3.9 | **Admin payout preview with human confirmation** | Transfers do not fire without it |
| 3.10 | Reconciliation assert: ledger total === Stripe total | Mismatch halts the run and pages |
| 3.11 | Creator payouts screen + downloadable statements | Must reconcile to the cent |
| 3.12 | **Money property tests: 10,000 random cases** | `creator + platform === net`, both non-negative |
| 3.13 | Ledger simulation: 1,000 orders with random refunds/disputes | Assert no immature or unreviewed order ever pays out |

**Exit test:** a real payout reaches a real bank account, and the downloadable statement reconciles to the cent against the Stripe dashboard.

---

## Phase 4 · Attribution — Weeks 13–14

| # | Task |
|---|---|
| 4.1 | `/go/[slug]` redirect, `link_events` write, `pf_ref` cookie (7d, first-party) |
| 4.2 | Link manager: create, label, copy, QR |
| 4.3 | Order matching from checkout metadata |
| 4.4 | Revenue-by-source table |
| 4.5 | **By-content table** — the money screen, with `--mint`/`--blush` row tinting |
| 4.6 | "Direct" bucket for unattributed orders — never guessed |

**Exit test:** a tracked link's clicks and resulting sales reconcile exactly, and an unattributed purchase correctly shows as Direct.

---

## Phase 5 · Referrals — Weeks 15–16

| # | Task | Notes |
|---|---|---|
| 5.1 | `/r/[handle]` capture, `pf_r` cookie 30d | |
| 5.2 | Binding at signup only, immutable | DB trigger already enforces |
| 5.3 | Single-tier rejection | **Already DB-enforced — verify, don't reimplement** |
| 5.4 | Referral ledger pairing on every eligible sale | |
| 5.5 | Reversal on refund and dispute | |
| 5.6 | Fraud controls: device/IP clustering, bank identity match, $100 minimum referee GMV | All required at launch, not later |
| 5.7 | Referral maturation after referee's own earnings | |
| 5.8 | Referrals dashboard screen | |
| 5.9 | Admin referral-integrity screen | |

**Exit test:** a referral earns correctly, then a refund on the underlying order claws it back exactly, and a tier-2 attempt is rejected.

---

## Phase 6 · Generation — Weeks 17–19

| # | Task | Notes |
|---|---|---|
| 6.1 | Three-question intake | |
| 6.2 | Five **product packages** with prices and asset lists | Packages, not documents |
| 6.3 | **Outline approval gate** | Non-skippable. Cost control and quality gate |
| 6.4 | PDF generation worker (reportlab pipeline) | Reuse your existing KDP work |
| 6.5 | Section-level editor with regenerate | |
| 6.6 | Cover generation | |
| 6.7 | Sales copy generation | |
| 6.8 | Cost tracking per generation, hard cap per creator per day | |

**Exit test:** a generated multi-asset product passes review and sells to a real buyer.

---

## Phase 7 · Intelligence — Month 5+

Cross-sell pairs, price-elasticity flags, "what to make next" seeded from real platform conversion data. Only meaningful after Phases 1–6 have run volume. This is the moat; it cannot be built early.

---

## Launch gates

Do not open signups until every box is ticked.

- [ ] Terms, creator agreement (net-vs-gross split + referral terms), refund and privacy pages live and lawyer-reviewed
- [ ] Stripe business description matches what the product does
- [ ] 28 schema smoke tests green in CI
- [ ] Money property tests green (10,000 cases)
- [ ] Malware scanning verified against a real EICAR test file
- [ ] Review queue operable at under 60 seconds per item
- [ ] Delivery evidence verified on a real purchase, both asset types
- [ ] A real payout landed in a real bank account and reconciled
- [ ] Refund flow tested by someone who is not you
- [ ] Statement descriptor confirmed on a live card charge
- [ ] Radar rules configured
- [ ] Referral clawback tested end to end
- [ ] RLS test passes for every protected table
- [ ] Accessibility pass at 375px, keyboard only
- [ ] Service-role key absent from the client bundle (CI check)

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Stripe terminates the account** | Medium | **Fatal** | Accurate business description, delivery evidence on every order, refunds easier than disputes, descriptor discipline, dispute rate monitored daily. Evaluate Polar or Paddle as MoR fallback by month 6 |
| Ledger bug at scale | Medium | Severe | Append-only enforced by trigger, property tests, reconciliation assert, human payout confirmation |
| Low-ticket dispute density | **High** | Severe | Per-price-band tracking, auto-restrict sub-$9 above 0.5%, bundles pushed in UI |
| Referral fraud | Medium | Moderate | Fingerprint clustering, bank identity match, $100 minimum GMV, delayed maturation |
| Review queue backlog | High | Moderate | Risk tiering (full/spot/auto), keyboard-driven queue, alert at 50 pending |
| Tax registration missed | Medium | Severe | Stripe Tax alerts + a CPA retained from month one, not month twelve |
| Generation quality drives refunds | Medium | Moderate | PDF-only in V1, outline gate, human review before payout |
| Solo-founder bandwidth | **High** | Severe | Phases are sequential for a reason. Do not parallelise Phase 3 |

---

## Weekly rhythm

- **Monday** — payout run preview and confirmation. Non-negotiable, blocks everything else.
- **Daily** — review queue to zero. It gates other people's money.
- **Friday** — dispute rate, review backlog, negative balances, tax thresholds.

---

## Success and kill criteria

**Success at 90 days post-launch:** 25+ creators with 3 or more sales each. Dispute rate under 0.5%. At least one creator earning $500+/month. 20%+ of new creators arriving via referral.

**Kill criteria, set now:** fewer than 25 creators with 3+ sales at 90 days, **or** dispute rate above 0.75% at any point. If either fires, stop and reassess rather than pushing through.

---

## Dogfood first

Point this at Tiny Treasures and AI Forge before selling it to anyone. If it can't tell you which of your own Shorts drove a sale, it isn't ready. Costs nothing and produces your first case study.
