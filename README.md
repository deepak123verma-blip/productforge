# ProductForge

Where a creator runs their entire digital product business: make or upload multi-asset products, sell them from one link, see which content produced the money, and get paid weekly. Specs live in [docs/](docs/); the rules that are expensive to get wrong live in [CLAUDE.md](CLAUDE.md).

## Prerequisites

- **Node 22** (`.nvmrc`; `nvm use` or install from nodejs.org)
- **pnpm 9** — `corepack enable` or `npm i -g pnpm`
- **Docker** — required by the Supabase CLI's local stack
- **Supabase CLI** — `npm i -g supabase` (or scoop/brew)
- **Stripe CLI** — for local webhooks (`stripe listen`)
- **psql** — the Postgres client, on your PATH (bundled with Postgres installers)

## First run

```bash
pnpm install
cp .env.example .env.local        # then fill in the values (comments say where each comes from)

# Fonts: download General Sans (Regular, Medium, Semibold woff2) from
# https://www.fontshare.com/fonts/general-sans into app/fonts/general-sans/
# (its licence requires downloading via Fontshare; the two Google fonts
# are handled automatically by next/font).

supabase start                    # local Postgres on 127.0.0.1:54322
pnpm db:migrate                   # applies db/migrations/*.sql in order
pnpm db:test                      # runs the smoke tests — expect 31/31 PASS

pnpm dev                          # http://localhost:3000
```

## Webhooks (local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET in .env.local
```

## Tests & checks

```bash
pnpm typecheck        # strict TS
pnpm lint             # eslint + money float guard
pnpm test             # all vitest suites
pnpm test:money       # money property tests (Phase 3+)
pnpm test:rls         # RLS isolation tests (Phase 3+)
pnpm db:reset         # drop + recreate the local schema
pnpm check:secrets    # server-only keys absent from the client bundle
pnpm check:contrast   # WCAG AA over the token matrix
```

CI runs typecheck, lint, the schema smoke tests against `postgres:16`, the money tests, the bundle secrets grep, and the contrast check on every PR.

## Rules of the road

- Never edit an applied migration; schema changes are new numbered files in `db/migrations/` with smoke tests appended in `db/tests/`.
- All money is integer cents. The ledger is append-only. Balances are always `SUM(ledger_entries)`.
- Every colour and size comes from a token in `app/globals.css`.
- Check `docs/DECISIONS.md` before deciding anything twice.
