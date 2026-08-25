---
name: money-ledger
description: Apply whenever work touches the ledger, payouts, splits, refunds, disputes, referral earnings, or balances — anything in lib/money/**, db/ money tables, or tests/money/**.
---

# Money & ledger

## The split algorithm

```ts
const net      = gross - processing;        // processing from Stripe balance transaction, never estimated
const creator  = Math.floor(net * 0.75);    // rounds toward the platform
const platform = net - creator;             // absorbs the remainder cent
```

Never compute the platform share independently. `creator + platform === net` must hold exactly; the DB `split_balances` CHECK rejects drift.

**Worked examples** (2.9% + $0.30 processing):

| Gross | Processing | Net | Creator (floor 75%) | Platform |
|---|---|---|---|---|
| $5.00 → 500 | 45 | 455 | 341 | 114 |
| $29.00 → 2900 | 114 | 2786 | 2089 | 697 |
| $79.00 → 7900 | 259 | 7641 | 5730 | 1911 |

(Illustrative — always use the actual `processing_cents` Stripe reports, always whole cents. `floor(455 × 0.75) = 341`, not 342: never round-half-up. These rows are asserted against `computeSplit` by `tests/money/doc-examples.test.ts` — docs cannot drift from the code.)

## Ledger entry types and sign rules

Credits are positive, debits negative. DB CHECKs enforce:

| Type | Sign | Meaning |
|---|---|---|
| `sale` | + | Creator's share of an order |
| `referral` | + | Referrer's 5% of platform revenue |
| `reserve_release` | + | Reserve returned |
| `refund` | − | Reversal of a sale |
| `dispute` | − | Reversal + $15 fee share |
| `referral_reversal` | − | Paired reversal of a referral |
| `reserve_hold` | − | Reserve withheld |
| `payout` | − | Funds leaving to the creator |
| `adjustment` | ± | Manual admin correction |

`ledger_entries` is append-only (trigger-enforced). Balance is always `SUM(ledger_entries)` — the `creator_balances` view, never a stored column.

## Referral pairing — literal SQL

Both entries in one transaction or neither:

```sql
BEGIN;
  INSERT INTO ledger_entries (creator_id, order_id, type, amount_cents)
  VALUES ($seller, $order, 'sale', $creator_cents);

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

Reversal mirrors this exactly (`refund` + `referral_reversal`, one transaction). Never derive referral earnings by aggregation after the fact. Referral earnings mature after the referee's own (`matures_at + 1 day`).

## Payout assembly sequence

Monday 09:00 UTC, per creator under an advisory lock:

1. Sum unpaid ledger entries whose orders are in `payable_orders` (matured AND review cleared).
2. Apply reserve (`reserve_pct` of period sales, within the 90-day window).
3. Net off clawbacks since the last run.
4. Skip if `payouts_paused`, KYC ≠ verified, net < $10, or net ≤ 0.
5. Write `payouts` row in `pending`. **Human confirms** → `confirmed` (with `confirmed_at`/`confirmed_by`) → `executing` → Stripe `transfers.create` with idempotency key `payout:{payout_id}` → `sent` or `failed`. The DB state machine rejects any other path.
6. Stamp `payout_id` onto constituent ledger rows; write the `payout` debit entry.

Negative balances carry forward. Never claw back from a bank account.

**Clawback timing rule:** debits (refund, dispute, referral_reversal) enter the payout **immediately**, regardless of the parent order's maturity or review state; credits obey maturity + review-cleared. Reason: a debit only ever reduces what leaves the platform — delaying it while releasing the matching credits overpays the creator and the money is gone. `assemblePayout` encodes this; don't "fix" it to symmetric behaviour.

## The reconciliation assert

After every run, per creator: `SUM(ledger) === Stripe transfer total`. Any mismatch **halts the run and pages**. Do not retry, do not auto-correct.

---

**Write the test first, always.**
