# ProductForge — Application Flow

**Version** 2.0 · **Companion to** PRD v2.0, TRD v2.0

---

## 1. Creator onboarding

```
Landing → [Start selling] → magic link email → verify
   ↓
Claim handle          @yourname   (unique, immutable after first sale)
   ↓
Referral captured?    pf_r cookie present and valid
   ↓                  → creators.referred_by_creator_id  (SET ONCE, IMMUTABLE)
                      → referral_expires_at = now() + 12 months
   ↓
Dashboard — empty state, one action: Create product
   ↓
Stripe Connect KYC    → deferred deliberately, see below
```

**KYC is not blocking.** A creator can build, publish and sell before verifying. Verification only gates the *payout*. If they hit Monday unverified, the payout is skipped and an attention card appears. This removes the biggest drop-off point in creator onboarding: nobody wants to upload a passport before they've seen the product work.

**Referral capture rules:**
- `/r/{handle}` sets `pf_r` cookie, 30 days, first-party.
- Bound at account creation only. Never retroactively.
- Rejected if: the referrer was themselves referred (single tier — DB-enforced), self-referral, or the device/IP fingerprint matches the referrer's.
- Once written, immutable. Enforced by trigger, not application code.

---

## 2. Publishing a product

### 2.1 Upload path

```
Create product → Upload what you have
   ↓
Drop files (multiple at once)
   ↓  per file, in parallel:
   ├── virus scan (VirusTotal: hash lookup → upload if unknown)
   ├── magic-byte check vs declared type
   ├── archive inspection (depth ≤3, ratio ≤100×)
   └── checksum + store to private bucket
   ↓
Asset list → reorder, rename, add link assets
   ↓
Title, description, price (≥ creator's floor), cover
   ↓
[ Publish ]
   ↓
SAFETY PIPELINE — synchronous, <10s
   ├── pass  → status=live, review_state=pending    → SELLABLE IMMEDIATELY
   ├── flag  → status=live, review_state=pending, flagged for full review
   └── fail  → stays draft, specific reason shown
   ↓
Live. Link copyable. Enters async review queue.
```

### 2.2 Generate path

```
Create product → Make something new
   ↓
3 questions: what you know / who you help / what they struggle with
   ↓
5 product PACKAGES (name, price, asset list) — not 5 documents
   ↓
Creator picks one
   ↓
┌──────────────────────────────────────────────────────┐
│  OUTLINE APPROVAL GATE                               │
│  Nothing generates until approved.                   │
│  Cost control + quality gate. Non-skippable.         │
└──────────────────────────────────────────────────────┘
   ↓
Generate assets (PDF only in V1) → job queue, progress shown
   ↓
Section-level editor, regenerate per section
   ↓
Creator may upload non-PDF assets into the same product
   ↓
Cover + sales copy generated
   ↓
[ Publish ] → same safety pipeline as above
```

**Why PDF-only generation in V1:** AI writes spreadsheets whose formulas break silently, and a broken tracker is a refund. Creators upload XLSX themselves into the same bundle. Full multi-format products, no bet on generation quality that can't yet be controlled.

---

## 3. Product state machine

```
                    ┌─────────┐
                    │  draft  │←──────── safety FAIL
                    └────┬────┘
                         │ publish + safety pass/flag
                         ▼
                    ┌─────────┐
        ┌───────────│  live   │───────────┐
        │           └────┬────┘           │
        │ admin restrict │ admin remove   │ creator unpublish
        ▼                ▼                ▼
  ┌────────────┐   ┌──────────┐     ┌─────────┐
  │ restricted │   │ removed  │     │  draft  │
  └────────────┘   └──────────┘     └─────────┘
   not sellable     terminal          editable
   existing buyers  buyers keep
   keep access      access

REVIEW STATE runs in parallel and gates money, not visibility:

   pending ──review──► cleared    → orders become payable
      │                             (combined with matures_at)
      └────review──► rejected     → product restricted,
                                    outstanding orders refunded,
                                    ledger entries reversed
```

**The core idea:** `status` controls whether it can be *sold*. `review_state` controls whether the money can be *paid out*. They are independent, and that independence is what buys instant publishing without accepting piracy risk.

---

## 4. Purchase and delivery

```
Buyer taps creator's link
   ↓
/go/{slug} → write link_event → set pf_ref cookie (7d) → 302
   ↓
Product page → cover, price, WHAT'S INSIDE (asset list), preview, refund policy
   ↓
[ Buy ] → Stripe Checkout Session
          metadata: { product_id, version_id, source_link_id from cookie }
   ↓
Stripe hosted checkout (Tax applied at buyer location)
   ↓
┌─ WEBHOOK: checkout.session.completed ───────────────────┐
│  create order (state=paid, processing_cents=0, fees     │
│  pending), create buyer user if new, issue signed       │
│  tokens, send delivery email                            │
└─────────────────────────────────────────────────────────┘
   ↓
Success page — every asset accessible immediately
   ↓
┌─ WEBHOOK: charge.succeeded (fees now known) ────────────┐
│  set processing_cents from balance transaction          │
│  compute split: net = gross − processing                │
│                 creator = floor(net × 0.75)             │
│                 platform = net − creator                │
│  matures_at = created_at + 14 days                      │
│  ATOMIC: write 'sale' + paired 'referral' if applicable │
└─────────────────────────────────────────────────────────┘
```

**Order of operations matters:** the order exists and the buyer has their files before fees are known. Delivery never waits on accounting.

### 4.1 Asset delivery differs by type

| | `file` | `link` |
|---|---|---|
| Delivery | Signed JWT → `/api/d/{token}`, 24h TTL | Gateway `/api/l/{token}` → 302 to external URL |
| Evidence | `download` event: order, asset, ts, ip_hash, UA | `link_open` event only — **weaker** |
| Revocable after refund | Yes — `jti` blacklisted | **No** |

Link-only orders are flagged in the disputes queue and weighted in creator risk scoring. New creators cannot publish link-only products until three products have cleared review (DB-enforced).

### 4.2 Re-access

`/access` — buyer enters their email, receives a magic link, sees purchases with current versions. **Not a dashboard.** It exists because signed URLs expire, version updates need a home, and download history wins chargebacks.

---

## 5. Refund and dispute

```
REFUND (buyer-initiated, 14 days, one click, no questions)
   ↓
Stripe refund → webhook charge.refunded
   ↓
ATOMIC TRANSACTION:
   ├── ledger 'refund'            −creator_cents
   ├── ledger 'referral_reversal' −referral_cents   ← if one was written
   ├── order.state = 'refunded'
   └── blacklist all signed token jti for this order
   ↓
If the creator was already paid → balance goes negative, carried forward.
No clawback from a bank account, ever.
```

```
DISPUTE (buyer goes to their bank instead)
   ↓
webhook charge.dispute.created
   ↓
ATOMIC: ledger 'dispute' = −(creator_cents + $15 fee share)
        ledger 'referral_reversal'
        order.state = 'disputed'
   ↓
AUTO-ASSEMBLE EVIDENCE from delivery_events:
   • download timestamps, IP hashes, user agents
   • email sent + opened events
   • product page snapshot at time of purchase
   • refund policy shown at checkout
   ↓
Admin reviews, submits before evidence_due_at
   ↓
   ├── won  → ledger 'adjustment' + restores the amount
   └── lost → stands; creator risk score updated
```

**A refund costs $5. A chargeback costs $15 plus a dispute rate you cannot unwind.** Every design decision here makes refunding easier than disputing.

---

## 6. Weekly payout run

```
Monday 09:00 UTC → cron
   ↓
FOR EACH creator (advisory lock per creator):
   ↓
   Sum unpaid ledger entries WHERE order IN payable_orders
        payable = state='paid' AND matures_at ≤ now()
                  AND product.review_state = 'cleared'
   ↓
   Apply reserve (reserve_pct of period sales, if within 90 days)
   ↓
   Net off clawbacks since last run
   ↓
   SKIP IF: payouts_paused | kyc ≠ verified | net < $10 | net ≤ 0
   ↓
   Write payouts row, state = 'pending'
   ↓
┌───────────────────────────────────────────────────────┐
│  ADMIN PREVIEW — HUMAN CONFIRMATION REQUIRED          │
│  totals · per-creator · blocked-by-review · skipped   │
│  Transfers DO NOT fire without this.                  │
└───────────────────────────────────────────────────────┘
   ↓
   Stripe transfers.create, idempotency key payout:{payout_id}
   ↓
   Stamp payout_id onto constituent ledger rows
   Write 'payout' debit entry
   ↓
   RECONCILE: SUM(ledger) === Stripe transfer total, per creator
        mismatch → HALT THE RUN, page, do not retry
   ↓
   Email creator: "$412.60 is on its way"
```

---

## 7. Referral earning flow

```
Alice shares productforge.com/r/alice
   ↓
Bob signs up      → creators.referred_by_creator_id = Alice
                  → referral_expires_at = now() + 12 months
                  → REJECTED if Alice was herself referred (single tier)
   ↓
Bob's product sells for $29
   ↓
net = $27.86 · Bob = $20.89 (floor 75%) · platform = $6.97
   ↓
Alice earns 5% OF PLATFORM REVENUE = $0.34 (floored)
   (not 5% of Bob's sales, which would be $1.45)
   ↓
Referral entry matures AFTER Bob's own earnings mature  ← fraud control
   ↓
Paid in Alice's normal weekly payout
   ↓
Bob refunds → Alice's $0.34 reversed atomically
```

**Fraud controls active throughout:** device and IP fingerprint clustering, payout bank identity matching, $100 minimum referee GMV before referral earnings unlock, buyer-card-matches-creator-card detection.

---

## 8. Edge cases

| Case | Behaviour |
|---|---|
| Creator publishes then deletes a product with live orders | Product → `removed`. Buyers keep access permanently. Assets never deleted from storage |
| Creator publishes a new version | Old buyers get the new version free, plus a changelog email. Purchases bind to `product_id`, not `version_id`, for access |
| Buyer purchases twice | Allowed. Two orders, two access grants. No dedupe — could be a gift |
| Product rejected after sales | Product restricted, outstanding orders auto-refunded, ledger reversed, creator notified with reason |
| Creator's KYC fails | Payouts skipped, funds accrue in ledger indefinitely. Attention card. No forfeiture |
| Referrer deletes their account | Referral entries persist and pay out. `ON DELETE RESTRICT` on ledger FKs prevents orphaning |
| Bundle member product removed | Bundle unaffected — `bundle_items` uses `ON DELETE RESTRICT`. Must be removed from the bundle first |
| Stripe pauses payouts to a country | Payout row → `failed` with reason. Retries next run. Funds stay in the ledger |
| Two webhooks arrive out of order | `processed_events` table makes each idempotent. `charge.succeeded` before `checkout.session.completed` queues and retries |
| Buyer's in-app browser breaks attribution | Order recorded with `source_link_id = NULL`, displayed as "Direct". Never guessed |
| Creator changes handle after a sale | Blocked. Handle is immutable after first sale — existing links must not break |
| Safety pipeline times out (>30s) | Publish blocked with a retry action. **Never allowed through on timeout** |
| Clawbacks exceed the period's earnings | Negative balance carried forward. No transfer, no bank clawback |

---

## 9. Notification map

| Trigger | To | Channel |
|---|---|---|
| Purchase complete | Buyer | Email with all asset links |
| New sale | Creator | In-app; daily email digest |
| New version published | Past buyers | Email with changelog |
| Product cleared review | Creator | In-app only |
| Product rejected | Creator | Email + attention card, with reason |
| Payout sent | Creator | Email |
| Payout skipped (KYC/paused) | Creator | Email + attention card |
| Dispute opened | Creator + admin | Email; admin paged if `evidence_due_at` < 48h |
| Referral earned | Referrer | In-app; monthly email summary |

Creators get in-app for routine events and email for money and blockers. Over-emailing a creator about every $5 sale is how you get muted.
