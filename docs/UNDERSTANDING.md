# ProductForge — Understanding

**Written before scaffolding. Checked against PRD v2.0, TRD v2.0, schema v2.0, and the application flow.**

## 1. Commercial model

ProductForge is a **Merchant of Record** platform: Loom Labs AI LLC (US) is the legal seller of every product. Creators licence their content to the platform and take a revenue share — they are not the merchants. Payments run entirely through Stripe (Checkout + Tax + Connect Express + Radar). Connect uses the `recipient` service agreement with the `transfers` capability only (no `card_payments`), and fund flow is **separate charges and transfers without `on_behalf_of`** — required so creators in India (and other cross-border creators) can be paid. Loss liability sits with the platform (`controller.losses: application`).

The split is **flat 75% creator / 25% platform, computed on net after Stripe processing fees** — not gross. On a $5 sale: gross $5.00 − processing $0.445 = net $4.555 → creator $3.42, platform $1.14. Net-not-gross keeps the model viable at the $5 minimum price; at gross the platform's effective take inverts at low ticket. This must appear in the creator agreement and as its own line on every payout statement.

Payouts are weekly on Mondays, USD only, T+14 maturation from purchase, 10% new-creator reserve for the first 90 days (released if dispute rate < 0.5%). Positioning is commerce first: lead with "You keep 75%", never with AI.

## 2. The five hard money invariants

1. **All money is integer cents.** BIGINT in the DB, integers everywhere in code and UI. No floats, ever.
2. **`ledger_entries` is append-only.** Corrections are new rows; a DB trigger rejects UPDATE and DELETE. The ledger is the single source of truth for all money.
3. **Balance is always derived** — `SUM(ledger_entries)` per creator (the `creator_balances` view). Never a stored or cached column. Payouts derive from the ledger, never the reverse.
4. **The split reconciles exactly:** `net = gross − processing`; `creator = floor(net × 0.75)`; `platform = net − creator`. Rounding always favours the platform so `creator + platform === net` holds to the cent — enforced by the `split_balances` and `net_balances` CHECK constraints. `processing_cents` comes from Stripe's **balance transaction** (arrives with `charge.succeeded`), never estimated; an order is not payable until fees are final.
5. **Referral entries are atomically paired.** A `referral` ledger entry is written in the *same transaction* as its parent `sale`, and reversed in the same transaction as any refund or dispute. Never derived by later aggregation — this is a second claim on the same order and the place subtle money bugs live.

(Supporting rules that follow from these: an order enters a payout only when matured **and** review-cleared — invariant 4 in the PRD; and transfers never fire without human confirmation of the payout preview.)

## 3. Review gates the payout, not the listing

Publishing is **instant**: a synchronous automated safety pipeline (< 10s — malware, integrity, URL reputation, prohibited-content classifier; risk claims and duplicates flag but don't block) either blocks publish or the product goes live and is sellable immediately.

In parallel, `review_state` (`pending → cleared | rejected`) runs asynchronously with **human review**, because copyright/piracy can't be detected automatically. Money from a product **cannot enter a payout while its review is `pending`** — the `payable_orders` view requires `state='paid' AND matures_at <= now() AND review_state='cleared'`. Since T+14 maturation exists anyway, gating payout instead of publish costs nothing and removes the publish bottleneck. Risk tiering (full / spot / auto) keeps the queue tractable at under 60 seconds per item. `status` controls whether a product can be *sold*; `review_state` controls whether its money can be *paid out* — they are independent, and that independence is what buys instant publishing without accepting piracy risk. Rejection after sales → product restricted, outstanding orders refunded, ledger reversed.

## 4. Single-tier referral rule

Referrals pay **5% of ProductForge's platform revenue** from the referred creator (not 5% of their sales), for 12 months from signup, paid in the referrer's normal weekly payout with the same maturation and clawback rules — and referral earnings mature *after* the referee's own earnings.

**Single tier, one level, permanently — made unrepresentable in the schema, not just discouraged:**
- `creators.referred_by_creator_id` is set once at signup and immutable (trigger `trg_referrer_immutable`).
- A creator who was themselves referred can never appear as anyone's referrer (trigger `trg_single_tier_referral` rejects the insert/update).
- No self-referral (CHECK constraint), and a referral ledger entry can't be self-referential.
- Fraud controls are launch requirements: fingerprint clustering, bank/tax identity matching, $100 minimum referee GMV, buyer-card-matches-creator-card detection, proportional clawback on every refund/dispute.

These are DB-enforced; application code verifies them, never reimplements them.
