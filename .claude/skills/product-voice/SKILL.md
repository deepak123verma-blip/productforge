---
name: product-voice
description: Apply on any user-facing copy — button labels, headings, error messages, empty states, emails, toasts, and money display anywhere in the product.
---

# Product voice

Sentence case. Active verbs. An action keeps its name through the flow — a "Publish" button produces a "Published" toast, never "Product created successfully."

## Say / don't say

| Say | Don't say |
|---|---|
| Your earnings | Revenue share disbursement |
| Your cut | Creator allocation |
| Clearing until 12 Nov | Funds in maturation window |
| We're checking this product | Pending moderation review |
| Payout account | Connected account |
| Goes out Monday | Scheduled for next payout cycle |

Never leak internals: no "webhook", no "merchant of record", no "maturation", no "connected account", no "RLS", no "ledger".

## Error messages

Structure: **what happened** (bold, specific) + what to do. Never apologise, never vague.

> **This file didn't pass our security scan.** Try re-exporting it from the original app, or upload a different file.

> **Your payout didn't go through.** Check your payout account details, then it retries next Monday.

Not: *"Sorry! Something went wrong. Please try again later."*

## Empty states

Pastel card, one line naming what goes here, one primary action. No illustration, no apology.

> **No products yet**
> Upload a file or make something new — either takes about two minutes.
> `[ Create product ]`

## Money formatting

- Space Grotesk, `tabular-nums`, always.
- Tables: always two decimals, never abbreviated — `$1,240.00`, not `$1.2k`. Creators check these against their bank.
- Stat cards may drop cents above $1,000: `$4,820`.
- Negatives: U+2212 minus (−) in `--negative`. Never a hyphen, never parentheses.
- Deltas prefixed `+` / `−`.
- All amounts come from integer cents; format at the edge, never store or compute in floats.
