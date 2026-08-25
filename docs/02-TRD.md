# ProductForge — Technical Requirements Document

**Version** 2.0 · **Companion to** PRD v2.0 · **Status** Ready for build

---

## 1. Stack

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Framework | **Next.js 15, App Router** | Server Actions remove a whole API layer for form work; route handlers cover webhooks |
| Language | **TypeScript, strict** | `strictNullChecks` non-negotiable in money code |
| Database | **Postgres 16 via Supabase** | RLS gives defence in depth; the schema depends on triggers and CHECK constraints |
| Auth | **Supabase Auth** — magic link + Google | No passwords to store or leak. Buyers never need an account |
| Storage | **Supabase Storage**, private buckets | Signed URLs with TTL; never public objects |
| Payments | **Stripe** — Checkout, Tax, Connect, Radar | Locked in PRD §1.1 |
| Queue | **Postgres-backed jobs** (`pgboss`) | One fewer service. Revisit at ~50k jobs/day, not before |
| Email | **Resend** + React Email | Receipts, delivery, version updates, payout notices |
| AI | **Anthropic API**, server-side only | Generation. Key never reaches the client |
| Malware | **VirusTotal** API (hash-first, upload-second) | Signature coverage comparable to ClamAV without a resident daemon. ClamAV returns only if VT rate limits bite (see DECISIONS.md) |
| Hosting | **Vercel only** — app, crons, extended-duration functions | Fluid compute runs functions to 800s (1800s beta) with Python first-class; Pro cron covers the workers. Revisit at volume, not before |
| Observability | **Sentry** + **PostHog** + **Better Stack** | Errors, product analytics, uptime |

**Deliberately not used:** Redis (Postgres advisory locks suffice at this scale), Kafka, microservices, an ORM that hides SQL from you in the money paths. Use Drizzle for typed queries but write the ledger operations as explicit SQL.

---

## 2. Architecture

```
                         ┌──────────────────────┐
   Browser ──────────────│  Next.js (Vercel)    │
                         │  - App Router pages  │
                         │  - Server Actions    │
                         │  - /api/webhooks/*   │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼──────────────────────┐
              │                     │                      │
      ┌───────┴────────┐  ┌─────────┴────────┐  ┌──────────┴───────┐
      │   Supabase     │  │     Stripe       │  │ Vercel Cron +    │
      │  Postgres+RLS  │  │  Checkout/Tax/   │  │ long functions   │
      │  Auth, Storage │  │  Connect/Radar   │  │ - outbox drain   │
      └───────┬────────┘  └─────────┬────────┘  │ - payout runner  │
              │                     │           │ - risk recompute │
              │      webhooks       │           │ - PDF/AI gen     │
              └─────────────────────┴───────────┴──────────────────┘
                              pgboss job queue
```

**Boundary rule:** every write that touches money runs inside a Postgres transaction initiated by a **service-role** connection, never from a client with RLS. RLS protects reads and creator-owned writes; the ledger is service-role only.

---

## 3. The money engine

This is the part of the system that must be correct. Everything else can be fixed in a patch release.

### 3.1 Split calculation

Given `gross_cents` and Stripe's reported `processing_cents`:

```ts
const net      = gross - processing;
const creator  = Math.floor(net * 0.75);   // rounds toward the platform
const platform = net - creator;            // absorbs the remainder cent
```

**Rounding always favours the platform**, so `creator + platform === net` holds exactly. The DB `split_balances` CHECK enforces this and will reject any drift. Never compute the platform share independently.

`processing_cents` is read from the Stripe **balance transaction**, not estimated. It is not known at `checkout.session.completed`; it arrives with `charge.succeeded`. Order rows are created at session completion with `processing_cents = 0` and a `pending_fees` flag, then finalised when the balance transaction lands. **The order does not become payable until fees are final.**

### 3.2 Order lifecycle

```
checkout.session.completed  → create order (state=paid, fees pending)
charge.succeeded            → set processing_cents, compute split,
                              write ledger 'sale' (+ paired 'referral' if applicable)
                              set matures_at = created_at + 14 days
charge.refunded             → write 'refund' (−) and 'referral_reversal' (−) atomically
charge.dispute.created      → write 'dispute' (− amount − $15 fee), same for referral
charge.dispute.closed(won)  → write 'adjustment' (+) restoring the amount
```

### 3.3 The referral pairing rule

A referral is a **second claim on the same order**. Both entries are written in one transaction or neither is:

```sql
BEGIN;
  INSERT INTO ledger_entries (creator_id, order_id, type, amount_cents)
  VALUES ($seller, $order, 'sale', $creator_cents);

  -- only if the seller has a live referrer inside their 12-month window
  INSERT INTO ledger_entries
    (creator_id, order_id, type, amount_cents, referral_of_creator_id)
  SELECT c.referred_by_creator_id, $order, 'referral',
         FLOOR($platform_cents * 0.05), c.user_id
  FROM creators c
  WHERE c.user_id = $seller
    AND c.referred_by_creator_id IS NOT NULL
    AND c.referral_expires_at > now();
COMMIT;
```

**Never derive referral earnings by aggregation after the fact.** Reversal mirrors this exactly.

Referral earnings mature *after* the referee's own earnings. **Maturation is derived, not stored:** a referral entry's maturity is the parent order's `matures_at + 1 day`, resolved by joining `ledger_entries.order_id → orders.matures_at` at payout-assembly time. No effective-date column exists on the ledger — one stored copy of the fact, on the order. (Ruling A2, docs/DECISIONS.md.) This is a fraud control, not an accounting nicety.

### 3.4 Weekly payout run

Runs Monday 09:00 UTC. **Never fires transfers without a human confirming the preview.**

1. **Assemble** — for each creator, sum unpaid ledger entries whose orders appear in `payable_orders` (matured *and* review cleared). Advisory-lock per creator.
2. **Apply reserve** — hold `reserve_pct` of the period's sales if within the 90-day window.
3. **Net off clawbacks** — refunds and disputes since the last run.
4. **Filter** — skip creators who are `payouts_paused`, unverified KYC, or below the $10 minimum transfer.
5. **Preview** — write `payouts` rows in `state='pending'`. Admin reviews totals, blocked-by-review list, and failures.
6. **Execute on confirmation** — Stripe `transfers.create` per creator, idempotency key `payout:{payout_id}`. On success, stamp `payout_id` onto the constituent ledger rows and write a `payout` debit entry.
7. **Reconcile** — assert `SUM(ledger) === Stripe transfer total` per creator. Any mismatch halts the run and pages.

**Negative balances:** if clawbacks exceed the period's earnings, the creator carries a negative balance forward. No transfer, no clawback from a bank account. Stripe holds a platform reserve against connected accounts that stay negative.

### 3.5 Idempotency

Every Stripe webhook is recorded in a `processed_events(stripe_event_id PRIMARY KEY)` table inside the same transaction as its effect. Replays are no-ops. Stripe retries for three days; assume every webhook will arrive more than once and out of order.

---

## 4. API surface

Server Actions for creator-facing mutations. Route handlers only where an external caller needs an endpoint.

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/webhooks/stripe` | POST | Signature | All Stripe events |
| `/api/webhooks/stripe/connect` | POST | Signature | `account.updated`, `transfer.failed` |
| `/api/checkout` | POST | Public | Create Checkout Session |
| `/api/d/[token]` | GET | Signed token | File download; writes `delivery_events` |
| `/api/l/[token]` | GET | Signed token | Link-asset gateway; writes `delivery_events` |
| `/r/[slug]` | GET | Public | Referral link; sets attribution cookie |
| `/go/[slug]` | GET | Public | Tracked content link; writes `link_events`, 302s |
| `/api/cron/payout-run` | POST | Cron secret | Assembles the weekly preview |
| `/api/cron/risk-recompute` | POST | Cron secret | Nightly dispute-rate recalculation |

### 4.1 Signed tokens

Download and link tokens are JWTs, 24h TTL, payload `{order_id, asset_id, jti}`, signed with a rotating key. `jti` is recorded so a token can be revoked after a refund. **File assets are effectively revocable; link assets are not** — this is stated to buyers and weighted in risk scoring.

---

## 5. Safety pipeline

Runs synchronously at publish. **Budget: under 10 seconds total.** If it exceeds 30s, publish is blocked with a retry, never allowed through.

| Stage | Tool | Timeout | On failure |
|---|---|---|---|
| File integrity | `file(1)`, magic bytes vs. declared type | 1s | Block |
| Malware | VirusTotal: sha256 lookup, then upload+poll for unknown hashes (rate-limit exhaustion and poll-cap expiry BLOCK) | 5s | Block |
| Archive inspection | Unzip depth ≤ 3, expansion ratio ≤ 100× | 2s | Block (zip bomb) |
| URL reputation | Google Safe Browsing on link assets | 2s | Block |
| Prohibited content | Claude Haiku classifier on title, description, extracted text | 4s | Block |
| Risk claims | Same call, separate output field | — | Flag, publish |
| Duplicate | pHash on cover, simhash on text, vs. existing catalogue | 3s | Flag, publish |

Results go to `safety_checks` regardless of outcome. Async human review then gates payout per PRD §7.2.

---

## 6. Attribution

**Cookie-based, first-party, 7-day window.**

1. `/go/[slug]` writes a `link_events` row, sets `pf_ref={link_id}` (first-party, 7d, `SameSite=Lax`), 302s to the product page.
2. Checkout Session is created with `metadata.source_link_id` from the cookie.
3. On `checkout.session.completed`, `orders.source_link_id` is populated.

**Known limitation, document it and do not pretend otherwise:** Instagram's in-app browser is a separate cookie jar from the system browser. If a buyer taps a link in Instagram then completes the purchase elsewhere, attribution is lost. Expect 10–20% unattributed and label it "Direct" rather than guessing.

---

## 7. Security

- **RLS on every table.** Verified by a test that enumerates `pg_tables` and asserts `rowsecurity = true`.
- **Service-role key is server-only.** A CI check greps the client bundle for it and fails the build on a hit.
- Storage buckets private; access exclusively via signed URLs.
- Webhook signature verification before any parsing, on every endpoint.
- IPs stored as `sha256(ip + rotating_salt)`, never raw. Salt rotates quarterly.
- Uploads: 500MB per asset, 2GB per product, extension allowlist, filenames sanitised, never served from the app origin.
- Rate limits: checkout 10/min/IP, download 30/min/token, publish 5/hour/creator, referral signup 3/day/device-hash.
- CSP with no `unsafe-inline`. Stripe Checkout is a redirect, not an embed.

---

## 8. Performance targets

| Surface | Target |
|---|---|
| Storefront / product page TTFB | < 200ms (ISR, 60s revalidate) |
| Product page LCP, 4G mobile | < 2.0s |
| Dashboard first paint | < 1.5s |
| Publish → live | < 10s including safety pipeline |
| Checkout → download available | < 3s |
| Webhook processing | < 500ms p95, always ack first and queue the work |
| Payout run, 1,000 creators | < 5 minutes |

Storefronts are the only pages that see real traffic — a creator with 200k followers posting a link is a traffic spike. Static-render them.

---

## 9. Testing

**Required before Phase 3 ships:**

- **Schema invariants** — the 28 smoke tests in `04-schema-smoke-tests.sql`, in CI, on every migration.
- **Money property tests** — for random `gross ∈ [500, 100000]` and `processing ∈ [0, gross]`, assert `creator + platform === net` and both are non-negative. Run 10,000 cases.
- **Ledger reconciliation** — simulate 1,000 orders with random refunds and disputes; assert `SUM(ledger) === expected` and that no payout includes an immature or unreviewed order.
- **Referral pairing** — earn, refund, assert reversal is exact and atomic.
- **Webhook idempotency** — replay every event type 3× and assert single effect.
- **RLS** — creator A cannot read creator B's orders, ledger, or payouts. One test per protected table.

---

## 10. Environments

| Env | Database | Stripe | Notes |
|---|---|---|---|
| Local | Supabase CLI | Test + `stripe listen` | Seeded via `pnpm seed` |
| Preview | Branch DB per PR | Test | Auto-torn-down |
| Production | Supabase Pro, PITR on | Live | Migrations are forward-only |

**Migrations are forward-only.** No down migrations against production — a rollback that touches the ledger is worse than the bug it reverses.

---

## 11. Operational runbook

| Alert | Threshold | Response |
|---|---|---|
| Dispute rate 30d | > 0.5% | Review the price bands and the creators driving it |
| Dispute rate 30d | > 0.75% | Restrict sub-$9 publishing platform-wide |
| Payout reconciliation mismatch | any | **Halt the run**, page, do not retry |
| Safety pipeline p95 | > 20s | Publish queue degrades to async; alert |
| Webhook failure rate | > 1% over 15m | Page |
| Negative-balance creators | > 2% | Review reserve policy |
| Review queue depth | > 50 pending | Payouts start blocking; clear it |
