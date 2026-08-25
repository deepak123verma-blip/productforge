# Decision log — append-only

Format: date · decision · reasoning · what would change our mind.

---

## 2026-08-25 — Merchant of Record model
Loom Labs AI LLC is the legal seller; creators licence content and take a revenue share (PRD §1.1).
**Why:** enables cross-border payouts (India), single Stripe account, platform controls refunds/disputes/tax.
**Would change our mind:** Stripe account termination risk materialising → evaluate Polar/Paddle as MoR fallback (revisit month 6).

## 2026-08-25 — 75/25 split on NET, not gross
Stripe processing is deducted before the split (PRD §0.1A, §2.3).
**Why:** at gross, a $5 sale leaves the platform an effective 16% take before costs; the model inverts at low ticket.
**Would change our mind:** dropping the $5 floor, or a materially different processing cost structure. Cheap to reverse only before Phase 2.

## 2026-08-25 — $5 minimum price with guardrails
**Why:** expands the product universe; dispute-density risk is mitigated by descriptor discipline, per-price-band tracking, auto-restriction of sub-$9 above 0.5% dispute rate, and aggressive bundle surfacing.
**Would change our mind:** dispute rate above 0.75% at any point (kill criterion).

## 2026-08-25 — Review gates the payout, not the listing
Publishing is instant behind a <10s automated pipeline; async human review blocks `payable_orders` until cleared (PRD §0.1B, §7).
**Why:** T+14 maturation already exists, so payout-gating costs nothing and removes the publish bottleneck.
**Would change our mind:** review queue persistently above 50 pending, or piracy losses exceeding the reserve.

## 2026-08-25 — Single-tier referrals, permanently
5% of platform revenue, 12 months, one level; tier 2 made unrepresentable by DB trigger (PRD §8, schema `trg_single_tier_referral`).
**Why:** multi-tier is an MLM pattern, a fraud magnet, and a regulatory risk.
**Would change our mind:** nothing in v1. Architected to be impossible on purpose.

## 2026-08-25 — Separate charges and transfers, WITHOUT `on_behalf_of`
**Why:** required for cross-border payouts to India under Connect `recipient` agreements.
**Would change our mind:** Stripe changing cross-border transfer rules; India no longer a target creator market.

## 2026-08-25 — PDF-only generation in V1
**Why:** AI-generated spreadsheets break formulas silently and a broken tracker is a refund. Creators upload non-PDF assets into the same bundle.
**Would change our mind:** a validation pipeline that proves formulas execute correctly (Phase 7 territory).

## 2026-08-25 — Migration 0002: payout state machine
Extended `payout_state` with `confirmed` and `executing`: `pending → confirmed → executing → sent/failed`, plus `confirmed_at`/`confirmed_by` columns, a transition-guard trigger, and confirmation immutability.
**Why:** the v1 enum couldn't distinguish "preview awaiting human confirmation" from "transfer in flight" — a crash mid-run left rows ambiguous, and the human-confirmation invariant (money rule 8) was unenforceable in the DB. `failed` is terminal per run; retries are new rows next run. Inserts must start at `pending` (conservative; prevents skipping the preview by inserting directly into a later state). Smoke tests 29–31.
**Would change our mind:** needing partial/segmented payout execution — that would be a further migration, never an edit to 0002.

## 2026-08-25 — Scaffolding: Tailwind 3.4, not 4
**Why:** the design spec mandates `tailwind.config.ts` mapping utilities to `var(--token)` with globals.css as the single source of truth — the v3 model. Tailwind 4's CSS-first config would put token wiring in CSS `@theme`, changing the mandated file layout.
**Would change our mind:** a deliberate migration that keeps globals.css as the only place hex values live.

## 2026-08-25 — Ruling A1: `--ink-3` darkened to #6B7175, surface/sunk only
Passes AA on `--surface` (4.95:1) and `--surface-sunk` (4.52:1). Permitted for captions there ONLY; `--ink-2` is mandatory on pastels and canvas — no lightness of ink-3 passes on pastels, permanently.
**Would change our mind:** nothing; the constraint is physical (pastel luminance).

## 2026-08-25 — Ruling A2: referral maturation is derived, never stored
A referral entry matures at its parent order's `matures_at + 1 day`, resolved by joining `ledger_entries.order_id → orders` at payout assembly. No effective-date column on the ledger — one stored copy of the fact. TRD §3.3 updated.
**Would change our mind:** payout-assembly join cost at serious scale → materialise then, with reconciliation tests.

## 2026-08-25 — Ruling A3: PRD §2.3 worked example corrected to integer cents
gross 500 → processing 45 → net 455 → creator 341 → platform 114. The algorithm was always binding; the prose was wrong.

## 2026-08-25 — Ruling A4/A5: sign_debits tightened in 0003; contrast CI stays permitted-matrix
Debit ledger types must be strictly negative (`< 0`, was `<= 0`) — folded into migration 0003. The contrast job checks the permitted usage matrix and asserts banned pairs fail; spec text updated to match.

## 2026-08-25 — Migration 0003: processed_events + strict debit signs
`processed_events(stripe_event_id PK, event_type, processed_at)` — the webhook idempotency table (TRD §3.5), written in the same transaction as each event's effect. `sign_debits` rebuilt as strictly negative. Smoke tests 32–34.
**Would change our mind (on strictness):** a genuine zero-amount Stripe event needing a ledger trace — record those as `adjustment` with a memo instead.

## 2026-08-25 — Data boundary: repository interface with env-selected backend
All screens read via `lib/db/repositories` (`types.ts` interface; `mock.ts` fixtures now; `supabase.ts` stubbed throwing NotImplemented). Selection by `DATA_BACKEND` env var in one file; nothing imports `mock.ts` directly.
**Why:** Phase 2 becomes a one-file swap, not a refactor.

## 2026-08-25 — Phase 1 offline: Instrument Sans as temporary body-font fallback
General Sans requires a licence-gated manual download; per instruction, `app/fonts.ts` uses Instrument Sans (Google) behind a `TODO(fonts)` marker so `pnpm build` never blocks. Swap back once the woff2s land.

## 2026-08-25 — Phase 1 offline: SWC wasm fallback on this machine
Windows App Control blocks Next's native SWC binary here. `@next/swc-wasm-nodejs` is pinned and staged into `next/wasm/` by a postinstall script (no-op elsewhere). CI/Linux uses the native binary.

## 2026-08-25 — Offline sprint: D5 fixture corrected + doc-drift test
Smoke fixture 06 now uses the binding split (2089/697; referral 34; balance 2123) — 34/34 PASS. `tests/money/doc-examples.test.ts` parses the PRD, Application Flow, the money-ledger skill, and the smoke-test fixture from the actual files and asserts every worked example against `computeSplit`/`referralAmount`, so docs can't silently drift again. Clawback-timing rule (debits enter immediately, credits obey maturity) documented in the money-ledger skill.

## 2026-08-25 — Offline sprint: honest stubs via a single registry
`lib/stubs/registry.ts` is the source of truth for every not-yet-wired surface (12 entries), rendered by `<NotYetWired>` (`--sky`) and listed at `/kitchen-sink/stubs`. Phase 2 progress = the registry emptying.
**Why:** scattered "coming soon" strings rot; one registry is auditable and names the blocking service.

## 2026-08-25 — Offline sprint: landing at `/`, legal pages live as drafts
Real landing page per PRD §4 (hero miniature is real components at 0.6 scale via `--miniature-*` tokens). `/legal/*` resolve with a "TODO: lawyer review" banner — Stripe reviewers follow those links, so 404s were not an option. Dev route list moved into /kitchen-sink. `qrcode` dependency added for offline QR generation on tracked links.

## 2026-08-25 — Fixture sprint: rulings A1–A3 applied
Attention cards use urgency tones (butter/blush/sky) — blush stays "buyers" elsewhere. Arrow chip scoped to cards; list rows are whole-row links with no chip. Attribution moved to landing position two. Spec + skill updated.

## 2026-08-25 — Fixture sprint: effect-based webhook handlers
Every Stripe handler is pure: `(event, state) → Effect[]`. Effects are described intents (InsertOrder, InsertLedgerEntries as one atomic batch, Requeue for out-of-order, …); one Phase-2 executor applies them in a single transaction WITH the processed_events row — that pairing is the idempotency guarantee, and a Requeue is never recorded as processed. 21 tests incl. 3× replay of every event type and the out-of-order charge.succeeded case.
**Why:** the money-engine logic is testable today; Phase 2 becomes plumbing.

## 2026-08-25 — Fixture sprint: safety pipeline behind a Scanners interface
Orchestration + decision matrix are pure (`lib/safety`); ClamAV/VT/Safe-Browsing/Haiku drop in behind `Scanners` in Phase 2. 91 tests: the 81-combination decision matrix exhaustively, plus timeout-is-block and throw-is-block — a hanging or crashing scanner can never pass a file.

## 2026-08-25 — Fixture sprint: session interface; Maya de-hardcoded
`lib/auth` (SessionProvider + requireCreator/requireAdmin) gates every creator page and /admin; the mock signs in the fixture creator. `Repository.getCurrentCreator` replaced by `getCreatorById` — who is signed in is the session's business, never the repository's. `canTransition` in payout-runner is a UI-convenience mirror of the DB payout state machine; the DB remains the enforcer.

## 2026-08-25 — Executor sprint: effect union split by transactionality (ruling A1)
`TransactionalEffect` (DB writes, applied in the event's transaction) vs `PostCommitEffect` (SendEmail/AlertAdmin — written to `effect_outbox` in the same transaction, sent by a drain worker after commit). Migration 0004: outbox table, drain index, state guard (sent needs ≥1 attempt; sent/abandoned terminal; abandoned keeps its error). Smoke tests 35–37 → 37/37. **The executor never makes an outbound call — if it wants the world, it writes a row.**

## 2026-08-25 — Executor sprint: deterministic order ids (ruling A2)
`orders.id = uuidv5(payment_intent_id, fixed namespace)` — knowable before the row exists (tokens/emails reference it directly), replay-idempotent by PK construction. The namespace UUID is permanent. RFC 4122 v5 verified against the canonical test vector.

## 2026-08-25 — Executor sprint: slice contracts + two ordering bugs the e2e caught
Every handler state slice documents its exact lookup + index (`lib/stripe/slice-contracts.ts`, schema-asserted by test). The out-of-order storm (every event 3×, reversed) caught two real gaps, both fixed as Requeues: `charge.dispute.closed` before the dispute row exists; and **`charge.refunded`/`dispute.created` before `charge.succeeded`** — which would have flipped the order with no ledger reversal and then credited the late sale anyway. Refunds and disputes now wait for fees-final. This is the design-problem class the simulation exists for.

## 2026-08-25 — Vercel-only topology: Fly.io removed from the plan
Everything runs on Vercel until volume forces otherwise. What made it possible: fluid compute runs functions to 800s GA on Pro (1800s beta) with Python first-class, and Pro cron allows 40 jobs at unlimited frequency — covering the outbox drain (every minute), payout runner (Mon 09:00 UTC), risk recompute (nightly), PDF and AI generation. **Vercel Pro is a hard Phase-2 prerequisite** (Hobby: 2 crons, daily only).
**ClamAV dropped for launch, VirusTotal only.** clamd is a resident daemon holding ~1GB of signatures — an architectural mismatch with per-invocation serverless, not a timeout problem. Both are signature-based, so novel-malware coverage is comparably poor; VT's hash lookup catches everything known, instantly. Scanner strategy: hash first, upload second, poll capped; **rate-limit exhaustion and poll-cap expiry block, never pass.**
**Reversal trigger, concretely:** bring ClamAV back (as another `Scanners` implementation on a small always-on host) when VT rate-limit blocks affect >1% of publishes over a rolling week, OR first-seen file uploads exceed ~400/day (free-tier headroom), OR we pay for VT and it still can't hold publish p95 under the 10s budget. Also recorded in `lib/safety/scanners.ts`.

## 2026-08-25 — Scaffolding: `embedded-postgres` devDependency
Added `embedded-postgres@16.14.0-beta.17` so migrations and smoke tests can run on a machine with no Docker and no psql (this one). Clusters must be initdb'd with `--encoding=UTF8 --locale=C` — the Windows locale default is WIN1252, which cannot store the `→` characters in migration comments.
**Why:** verification must be real output, not a claim; CI's `schema` job still uses `postgres:16` + psql as the canonical path.
**Would change our mind:** Supabase CLI/Docker becoming the standard local setup — then drop the dependency.

## 2026-08-25 — Scaffolding: vitest `--passWithNoTests`
Test scripts pass with zero tests so CI is green during Phases 0–2 when `tests/` is intentionally empty.
**Why:** the alternative is stub test files that assert nothing, which is worse.
**Must be removed when Phase 3 lands** — a green `money` job with zero tests would then be a lie.
*Update (Phase 1 offline): removed from `test` and `test:money` — 17 real money tests exist. It remains only on `test:rls`, which stays empty until Supabase exists.*
