---
name: db-migrations
description: Apply on any schema change — new tables, columns, enums, triggers, constraints, or RLS policies in db/migrations/**.
---

# DB migrations

## Rules

1. **Forward-only.** No down migrations, ever. A rollback that touches the ledger is worse than the bug it reverses.
2. **Sequentially numbered:** `NNNN_short_name.sql` (`0001`, `0002`, …). Applied in filename order.
3. **Never edit an applied migration.** `0001_initial_schema.sql` is validated and frozen; every change is a new file.
4. **Every migration adds smoke tests** to `db/tests/smoke_tests.sql`, continuing the numbering. One test per new invariant.
5. `ALTER TYPE ... ADD VALUE` cannot share a transaction with statements that use the new value — apply migrations with plain psql autocommit, never `psql -1`.
6. Every new table gets `ENABLE ROW LEVEL SECURITY` and policies in the same migration.

## Local verification before committing

```bash
pnpm db:reset      # drop + recreate the scratch database
pnpm db:migrate    # applies db/migrations/*.sql in order
pnpm db:test       # runs db/tests/smoke_tests.sql; every line must be PASS
```

Or use the `/verify-schema` command. CI runs the same on every migration.

## DB-enforced invariants — verify, never duplicate in application code

The database already enforces these. Application code may rely on them and surface friendly errors, but must not reimplement them (two implementations drift):

- Ledger append-only (`trg_ledger_no_update` / `trg_ledger_no_delete`)
- Split reconciliation (`split_balances`, `net_balances` CHECKs on orders)
- Ledger sign discipline (`sign_debits`, `sign_credits`)
- Referral shape + no self-referral (`referral_shape`, `referral_not_self`, `no_self_referral`)
- **Single-tier referrals** (`trg_single_tier_referral`) and referrer immutability (`trg_referrer_immutable`)
- Per-creator price floor (`trg_price_floor`, min 500 cents)
- Link-only guard for a creator's first three products (`trg_link_only_guard`)
- Payout state machine `pending → confirmed → executing → sent/failed` (`trg_payout_state_machine`), confirmation immutability
- Bundle cannot contain itself (`no_self_bundle`)
- Payout period ordering (`period_ordered`)

If you need one of these behaviours, write a test that proves the DB rejects the bad write — do not add an application-layer check that shadows it.
