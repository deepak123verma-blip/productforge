# Open questions

Ambiguities found during scaffolding. Each carries the best-guess interpretation used (clearly marked as a guess) so work could continue.

---

## 1. General Sans font files cannot be committed automatically
Fontshare's ITF Free Font License requires downloading through their site; the woff2 files aren't fetchable in a way that's clearly licence-compliant to automate.
**Current state (per the Phase-1 instruction):** `app/fonts.ts` uses **Instrument Sans** from Google as a clearly-marked `TODO(fonts)` metric-similar fallback so `pnpm build` never blocks. Swap back to `next/font/local` + `app/fonts/general-sans/*.woff2` (README "Fonts") once the files are downloaded.

## 2. Which text/fill pairs must the CI contrast job check?
"Assert every text-token / fill-token pair meets WCAG AA" is impossible literally — the spec itself says `--ink-3` fails on every pastel by design.
**Guess used:** `scripts/check-contrast.mjs` checks the *permitted* usage matrix (ink and ink-2 on all fills; ink-3 on surface/canvas/surface-sunk only; white-on-ink; positive/negative/warning on surface) and additionally asserts the known-banned pairs (ink-3 on each pastel) genuinely fail AA, so the ban stays true if tokens change.

## 3. `--warning` (#B8791F) on white is ~3.4:1 — below AA for normal text
Not addressed in the spec. `--positive` and `--negative` pass; `--warning` does not at body size.
**Guess used:** the contrast script requires `--warning` on `--surface` at the AA *large-text* threshold (3:1) and the permitted matrix notes it must only be used at ≥ display-s/bold sizes. Flagging for an explicit ruling — the alternative is darkening the token. *(If the script's strict 4.5 check fails in verification, this is why; see the verification report.)*

## 4. Payout retry semantics after `failed`
"failed → (retried next run)" — retried as the same row or a new one?
**Guess used (conservative):** `failed` is terminal for the row; the next run assembles a new `payouts` row for the still-unpaid ledger entries. This keeps the state machine acyclic and the audit trail append-flavoured.

## 5. Direct inserts into `payouts` in non-pending states
Nothing forbids inserting a row directly as `sent`.
**Guess used (conservative):** migration 0002's trigger requires all inserts to start at `pending`. If a backfill ever needs otherwise, that's a new migration with its own reasoning.

## 6. `.claude/settings.json` permission granularity
"Require confirmation for anything that writes to a database or calls Stripe" — Claude Code permissions match tool patterns, not intent.
**Guess used:** allow reads and common dev commands (pnpm typecheck/lint/test, git status/diff/log); explicitly `ask` for `psql`, `node scripts/db.mjs`, `stripe`, `supabase db`, and anything matching curl/Invoke-WebRequest to stripe.com. Deny reading `.env*` files.

## 8. This machine blocks Next's native SWC binary (Windows App Control)
`next-swc.win32-x64-msvc.node` is refused by an Application Control policy (no Mark-of-the-Web — a real WDAC/Smart App Control rule), and Next's on-demand wasm download extracts an empty directory here.
**Workaround used:** `@next/swc-wasm-nodejs@15.5.23` pinned as a devDependency and copied into `next/wasm/` by `scripts/fix-swc-wasm.mjs` (postinstall; no-op on machines where the native binary loads). Builds are slower on wasm — CI/Linux is unaffected. If the App Control policy can be adjusted for this repo's node_modules, remove the workaround.

## 9. ~~Phase-1 screen ambiguities~~ — RESOLVED
Promoted into `docs/03-UIUX-Design-Spec.md` §11 (bundle price formula, restricted-storefront 404, tint averaging, dimension tokens, `--ink-12`, motion-in-globals, warning-large-text rule). Sales CSV export has since been built client-side. Admin decisions persist with the live backend.

## 7. ~~`--ink-3` fails WCAG AA on every fill~~ — RESOLVED (ruling A1)
Token darkened to `#6B7175` (4.95:1 on surface, 4.52:1 on surface-sunk). Permitted for captions on `--surface`/`--surface-sunk` only; `--ink-2` mandatory on pastels and canvas, permanently. Encoded in globals.css, the design-system skill, CLAUDE.md, and the contrast CI.

## 10. Lighthouse ≥90 not yet measured on this machine
The landing page is static, image-free, ~106kB first-load JS, well under the 400KB budget — it should clear mobile performance 90 comfortably, but headless Chrome isn't available here to produce a real score. Run Lighthouse from a normal Chrome install (DevTools → Lighthouse, mobile) against `pnpm build && pnpm start` and record the number; treat ≥90 as unverified until then.

## Disagreements

### D1. Smoke-test file header said "28 tests" with 27 labels
Resolved per owner: 28 statements (19b makes it 28), report as 28; label scheme kept. Now 31 with migration 0002's tests 29–31.

### D2. TRD §3.3 referral maturation: "set the referral entry's effective date to matures_at + 1 day"
The ledger has no `effective_date` column — only `ts`. As written this is unimplementable without either a schema change or abusing `ts`. Implemented nothing now (Phase 5 concern), but flagging: Phase 5 will need a migration adding `matures_at` (or `effective_at`) to `ledger_entries`, or maturation must be derived by joining the parent order. Prefer the derived join — fewer stored copies of the same fact.

### D3. PRD §2.3 worked example rounds oddly
$5.00 gross − $0.445 processing: Stripe reports integer cents, so processing is 44 or 45, never 44.5. The worked table ("Creator $3.42 / Platform $1.14" from net $4.555) doesn't survive integer-cents arithmetic exactly (with 45¢ processing: net 455 → creator 341 = $3.41, platform 114). Implemented as specified by the algorithm (floor of net×0.75 on integer cents) — the algorithm is binding, the prose example is illustrative. Worth correcting the PRD text.

### D5. Smoke-test fixture 06 doesn't match the binding split algorithm
Order fixture 06 uses `creator=2090, platform=696` for net 2786 — but `floor(2786 × 0.75) = 2089/697`. The DB CHECK only enforces the *sum*, so the fixture passes; `computeSplit` (and the golden tests) produce 2089/697. The fixture predates the ruling and is test data, not a money path, so it was left as-is per "never edit applied test expectations silently" — but it's worth aligning next time smoke_tests.sql is touched, so nobody copies 2090/696 as the canonical example.

### D4. ~~`sign_debits` allows zero-amount debits~~ — RESOLVED (ruling A4)
Tightened to strictly negative in migration 0003; smoke tests 33–34 cover it.
