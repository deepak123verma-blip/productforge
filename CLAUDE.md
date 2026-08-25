# ProductForge

## Project

ProductForge is where a creator runs their entire digital product business: make or upload multi-asset products, sell them from one link, see which content produced the money, and get paid weekly. Loom Labs AI LLC is Merchant of Record; creators take a 75% share of net. Full specs live in `docs/` (PRD, TRD, design spec, application flow, implementation plan).

## Non-negotiable money rules

1. All money is integer cents. No floats anywhere, including UI — floats drift and drift is a ledger bug.
2. `ledger_entries` is append-only. Corrections are new rows — the DB trigger rejects UPDATE and DELETE.
3. Creator balance is always `SUM(ledger_entries)`. Never a stored column, never cached — a cache can disagree with the truth.
4. The split is `creator = floor(net × 0.75)`, `platform = net − creator`. Rounding favours the platform so `creator + platform === net` always reconciles.
5. `net = gross − processing`. Processing comes from Stripe's **balance transaction** (`charge.succeeded`), never estimated — estimates break reconciliation.
6. A sale and its paired referral entry are written in one transaction or neither is — aggregating referrals later is where subtle money bugs live.
7. Orders become payable only when matured (T+14) **and** the product's review has cleared — this is what buys instant publishing.
8. Transfers never fire without human confirmation of the payout preview — the payout state machine (`pending → confirmed → executing → sent/failed`) enforces it.

## Non-negotiable design rules

1. Every colour and size comes from a token in `app/globals.css`. Never a hardcoded hex, never an arbitrary px value.
2. Pastels are semantic: mint=money, butter=products, blush=buyers, lilac=traffic, sky=referrals. Never chosen for variety.
3. Cards have no borders and no shadows. Only the panel and modals have shadows.
4. The arrow chip is the only "open this" affordance on cards. No text links, no chevrons.
5. `--ink-3` only on `--surface`/`--surface-sunk`; on pastels and canvas use `--ink-2` — no lightness of ink-3 passes there, permanently.

## Referral rule

Single tier, one level, permanently. A creator who was themselves referred can never appear as someone's referrer. **This is enforced by a DB trigger — verify it, never reimplement it in application code.**

## Voice

Sentence case. Active verbs. An action keeps its name through the flow ("Publish" → "Published"). Errors say what happened and what to do, and never apologise. Never leak internals to users: no "connected account", no "maturation", no "merchant of record", no "webhook".

## Current phase

`Phase 1 — Products (offline: component library, money lib, screens on mock data)`. Update this line as phases complete. Never build ahead of the current phase.

## Before you write code

- Check `docs/DECISIONS.md` for prior decisions on this area.
- Money code requires a test before the implementation.
- Schema changes require a new migration plus updated smoke tests. Never edit `0001_initial_schema.sql`.
