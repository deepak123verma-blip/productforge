---
description: Apply all migrations to a scratch DB and run the smoke tests, reporting pass/fail per test.
---

Verify the database schema end to end:

1. Reset the scratch database: `pnpm db:reset` (uses `DATABASE_URL`, defaulting to the local Supabase Postgres on 127.0.0.1:54322).
2. Apply every migration in order: `pnpm db:migrate`. Migrations must apply with plain psql autocommit — if you see an `ALTER TYPE ... ADD VALUE` transaction error, someone ran them inside a single transaction; do not "fix" it by editing an applied migration.
3. Run the smoke tests: `pnpm db:test`.
4. Report the actual output: every `PASS`/`FAIL` line and the final count (currently 31 expected). If anything failed, show the failing statement and stop — do not modify `0001_initial_schema.sql` to make a test pass; the fix is either a new migration or a corrected test, and either needs an entry in `docs/DECISIONS.md`.
