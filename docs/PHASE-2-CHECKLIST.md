# Phase 2 checklist — the day the accounts exist

Mechanical, not exploratory. Work top to bottom per service; the stub registry at `lib/stubs/registry.ts` (rendered at `/kitchen-sink/stubs`) is the progress tracker — it should empty as you go.

---

## 1. Stripe

### Account setup (do this exactly)
- Business description: **"digital content marketplace"**. Never "AI ebook generator" or similar — it reads as a restricted category.
- Statement descriptor: set and later verify on a live card charge (launch gate).
- Legal URLs for the reviewer (must resolve, already do): `/legal/terms`, `/legal/creator-agreement`, `/legal/refund-policy`, `/legal/privacy`.
- Stripe Tax: enabled, nexus monitoring on. Calculation only — registration/filing stays manual.
- Connect: **Express**, `service_agreement: recipient`, capability **`transfers` only** — never `card_payments`.
- Fund flow: **separate charges and transfers, WITHOUT `on_behalf_of`** — required for cross-border payouts (India). Do not add `on_behalf_of` for "cleaner reporting".
- Loss liability: `controller.losses: application`.
- Radar: rules configured before launch (launch gate).

### Env vars (`.env.local` / Vercel)
| Var | Where from | Exposure |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Dashboard → API keys | public |
| `STRIPE_SECRET_KEY` | Dashboard → API keys | **SERVER ONLY** |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` locally / webhook endpoint settings | **SERVER ONLY** |

### Files that change
- `lib/stripe/` — client, checkout-session creation, webhook handlers (idempotent via `processed_events`, migration 0003), transfer creation with key `payout:{payout_id}`.
- `app/api/webhooks/stripe/route.ts` (+ `/connect`) — signature-verify before parsing; ack <500ms; order lifecycle per `stripe-integration` skill.
- `app/api/checkout/route.ts` — session with `metadata.source_link_id` from the `pf_ref` cookie.
- `app/(store)/[handle]/[slug]/page.tsx` — enable the Buy button.

### Stubs cleared → tests unblocked
`checkout`, `refund`, `kyc-connect`; later `payout-run` (Phase 3). Unblocks: webhook idempotency tests (`tests/webhooks/`), the referral-clawback end-to-end, the live-card exit test.

---

## 2. Supabase

### Setup
- New project; run `db/migrations/*.sql` in order (plain autocommit, never `-1`); run `db/tests/smoke_tests.sql` → 34/34.
- Auth: magic link + Google. Storage: **private** buckets only.
- Replace the `current_user_id()` shim usage with `auth.uid()` in policies when wiring RLS to Supabase auth.

### Env vars
| Var | Where from | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project settings → API | public (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API | **SERVER ONLY** — ledger writes only |
| `DATABASE_URL` | Project settings → Database | server only |
| `DELIVERY_TOKEN_SECRET`, `IP_HASH_SALT`, `CRON_SECRET` | generate | **SERVER ONLY** |

### Files that change
- **`lib/db/repositories/supabase.ts` — fill in every `todo()`. This is the entire data swap.**
- Set `DATA_BACKEND=supabase`.
- `lib/db/` — service-role client (server-only) and Drizzle setup; ledger operations as explicit SQL per the TRD.
- Auth wiring: stop hardcoding Maya (`getCurrentCreator`), gate `(creator)` routes and `/admin` (role check).
- `app/api/d/[token]` and `/l/[token]` — signed-JWT delivery writing `delivery_events`.
- `/access` — real magic-link send/verify around the already-built purchases view.

### Stubs cleared → tests unblocked
`auth`, `upload-storage` (with the safety function), `access-magic-link` (with Resend), `version-publish` (with Resend), `review-persist`; later `link-tracking`, `referral-capture`. Unblocks: `tests/rls/` (write them, then **remove `--passWithNoTests` from `test:rls`**), ledger-write integration tests.

---

## 3. Vercel (Pro) — crons, long functions, VirusTotal

### HARD PREREQUISITE: Vercel Pro
Hobby caps crons at **2 jobs, daily frequency** — the every-minute outbox drain is impossible on it. Pro allows 40 jobs at unlimited frequency and 800s `maxDuration` (fluid compute). **Pro is required before Phase 2 ships, not a nice-to-have.**

### Setup
- `vercel.json` already declares the three crons (outbox-drain every minute, payout-run Monday 09:00 UTC, risk-recompute nightly) with per-route `maxDuration` — never a project-wide default.
- Env vars on Vercel: `CRON_SECRET` (crons authenticate with it), `VIRUSTOTAL_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` — all server-side.
- Every cron route runs under an advisory lock (`lib/cron/lock.ts`); Phase 2 swaps the in-memory provider for `pg_try_advisory_lock` on the service-role connection.
- PDF generation: a Vercel **Python** function under `app/api/generate/` with its own `maxDuration` entry when it lands (Phase 6). AI generation: extended-duration Node function.

### Malware: VirusTotal only (no ClamAV at launch)
- `lib/safety/virustotal.ts` is written and tested: hash-first lookup, upload+poll for unknowns, rate limiter (4/min, 500/day). **Exhaustion and poll-cap expiry block, never pass.**
- Phase-2 work: implement `VtClient` with real HTTP (v3 API: `GET /files/{sha256}`, `POST /files`, `GET /analyses/{id}`), compute sha256 at upload, wire into the publish pipeline.
- EICAR launch gate: upload the EICAR test file — its hash is universally known to VT, so the hash path blocks it instantly.
- ClamAV's return trigger is documented in `lib/safety/scanners.ts` and DECISIONS.md.

### Files that change
- `lib/safety/` — real `VtClient`; results into `safety_checks`.
- `app/api/cron/*` — swap MockStore/MockSender for the Supabase store + Resend sender (route shells and locks already exist).
- `app/(creator)/products/new` publish action — wire `UploadFlow`'s staged assets to storage + the pipeline.

### Stubs cleared
`upload-storage` (jointly with Supabase); `generation` in Phase 6.

---

## 4. Resend

### Setup
- Domain verified, sender configured. React Email templates in `lib/email/`.

### Env vars
`RESEND_API_KEY` — **SERVER ONLY**.

### Files that change
- `lib/email/` — receipt + delivery, `/access` magic link, version-update changelog (preview already built in `VersionPublisher`), payout sent/skipped notices, dispute alerts. Notification map: `docs/05-Application-Flow.md` §9.

### Stubs cleared
`access-magic-link`, `version-publish` (jointly with Supabase).

---

## Also on day one
- Fonts: download General Sans woff2 (Regular/Medium/Semibold) from Fontshare → `app/fonts/general-sans/`, swap `app/fonts.ts` back to `next/font/local`, delete the `TODO(fonts)` fallback.
- `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in the dev loop (README).
- Vercel deploy (Pro — see §3); Sentry/PostHog/Better Stack DSNs.
- Re-check `pnpm check:secrets` against the production build after each new env var.

## The executor — what changes when `store.ts` is Supabase-backed

The webhook path is fully written and e2e-tested offline (`lib/executor`, `tests/e2e`). Backing it with Supabase means writing ONE class implementing the `Store` interface (`lib/executor/store.ts`) with explicit SQL — nothing in `apply.ts`, `drain.ts`, the handlers, or the tests changes.

**`transact()`** → a Postgres transaction on the service-role connection (`BEGIN … COMMIT`, rollback on throw). Every `StoreTx` method is one statement inside it; `recordProcessedEvent` is the `processed_events` insert whose PK conflict is the replay guard at the DB level (the in-memory `processedEventIds()` check becomes `ON CONFLICT DO NOTHING` + rowcount, or a pre-select in the same transaction).

**Slice queries and their indexes** (also in `lib/stripe/slice-contracts.ts`, asserted by tests):
| Lookup | Index |
|---|---|
| order by payment intent | `orders.stripe_payment_intent_id` UNIQUE |
| product / link / creator by id | primary keys |
| sale entries by order | `idx_ledger_order` |
| dispute by stripe id | `disputes.stripe_dispute_id` UNIQUE |
| payout by transfer | `payouts.stripe_transfer_id` UNIQUE |
| creator by account | `creators.stripe_account_id` UNIQUE |
| active referrer | `creators` PK + `referral_expires_at > now()` |
| processed event | `processed_events` PK |
| outbox drain | `idx_outbox_drain (state, created_at) WHERE state IN ('pending','failed')` — claim with `FOR UPDATE SKIP LOCKED`, incrementing `attempts` in the claim UPDATE |

**Ordering guards baked into the handlers** (don't re-derive them): `charge.refunded` and `charge.dispute.created` requeue until the order's fees are final; `charge.dispute.closed` requeues until the dispute row exists; `charge.succeeded` requeues until the order exists. Requeue = pgboss retry with backoff, and the event is NOT recorded in `processed_events`.

**Outbox drain on Vercel Cron:** `/api/cron/outbox-drain` every minute under an advisory lock (route exists): claim due rows (`FOR UPDATE SKIP LOCKED`), send via Resend/alerting, `markOutboxSent`/`markOutboxFailed`. At-least-once — senders must tolerate duplicates (Resend idempotency key = outbox row id). `abandoned` rows page a human; they are terminal and keep `last_error`.

**Deterministic order ids:** `orders.id = uuidv5(payment_intent_id)` (`lib/stripe/order-id.ts`, namespace constant is permanent). The PK conflict on replay is expected and harmless — the transaction rolls back and the event was already, or will be, recorded as processed.

## Definition of done (Phase 2 exit test)
Buy your own product end to end on a live card: pay through hosted Checkout with tax, receive every asset, see the complete `delivery_events` log for both asset types, re-access via `/access`, then refund it — and watch the stub registry rows for phase 2 disappear.
