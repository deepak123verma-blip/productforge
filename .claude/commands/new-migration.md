---
description: Scaffold the next numbered migration with a matching smoke-test stub.
---

Create a new database migration. Arguments: a short snake_case name (e.g. `add_processed_events`).

1. Find the highest `NNNN` in `db/migrations/` and use `NNNN+1`, zero-padded to four digits.
2. Create `db/migrations/{NNNN}_{name}.sql` with a header comment stating **why** the change exists (not just what it does), and the reminder that `ALTER TYPE ... ADD VALUE` must not run inside a wrapping transaction.
3. Append smoke-test stubs to `db/tests/smoke_tests.sql`, continuing the test numbering, with at least one `must_pass` for the new happy path and one `must_fail` for each new invariant. Update the count comment at the top of that file.
4. New tables get `ENABLE ROW LEVEL SECURITY` plus policies in the same migration — no exceptions.
5. Remind: never edit an applied migration; migrations are forward-only; DB-enforced invariants must not be duplicated in application code (see the `db-migrations` skill).
6. Log the change in `docs/DECISIONS.md` (date, decision, reasoning, what would change our mind).
7. Verify locally: `pnpm db:reset && pnpm db:migrate && pnpm db:test`, and report the actual output.
