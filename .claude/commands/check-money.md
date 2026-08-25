---
description: Run the money property tests and the ledger reconciliation simulation.
---

Run the money verification suite and report actual results:

1. `pnpm lint` — includes the float guard over `lib/money/**`.
2. `pnpm test:money` — the property tests (10,000 random cases asserting `creator + platform === net`, both non-negative, for `gross ∈ [500, 100000]`, `processing ∈ [0, gross]`) and the ledger reconciliation simulation (1,000 orders with random refunds/disputes; `SUM(ledger) === expected`; no immature or review-pending order ever enters a payout).
3. If the suites don't exist yet (pre-Phase 3), say so explicitly — a pass with zero tests is not a pass. Check `CLAUDE.md` for the current phase.
4. Report failures verbatim with seed values so they can be reproduced. Never weaken an assertion to make it pass; money assertions changing requires a `docs/DECISIONS.md` entry.
