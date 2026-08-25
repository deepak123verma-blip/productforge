---
name: stripe-integration
description: Apply on any Stripe work — Checkout, Connect, Tax, Radar, webhooks, transfers, refunds, disputes, or anything in lib/stripe/** or app/api/webhooks/**.
---

# Stripe integration

## Connect configuration — locked

- Express accounts, `service_agreement: recipient`, capability `transfers` **only**. Never `card_payments`.
- Loss liability: platform (`controller.losses: application`).
- Fund flow: **separate charges and transfers, WITHOUT `on_behalf_of`** — required for cross-border payout to India. Do not add `on_behalf_of` "for cleaner reporting"; it breaks the cross-border model.
- Bank details are managed on Stripe-hosted Express pages. Never build a bank form.
- Checkout is hosted (redirect). Never a custom card form, never an embed.

## Webhook order of operations — fees arrive late

`processing_cents` lives on the **balance transaction**, which is not available at `checkout.session.completed`. It arrives with `charge.succeeded`.

```
checkout.session.completed → create order (state=paid, processing_cents=0, fees pending),
                             issue signed tokens, send delivery email
charge.succeeded           → set processing_cents from the balance transaction,
                             compute split (creator = floor(net × 0.75)),
                             set matures_at = created_at + 14d,
                             ATOMIC: ledger 'sale' + paired 'referral'
charge.refunded            → ATOMIC: 'refund' + 'referral_reversal', order → refunded,
                             blacklist token jtis
charge.dispute.created     → ATOMIC: 'dispute' (amount + $15 fee share) + 'referral_reversal'
charge.dispute.closed(won) → 'adjustment' restoring the amount
transfer.failed            → payout → failed with reason; retried next run
account.updated            → sync kyc_status
```

Delivery never waits on accounting: the buyer has their files before fees are known. **The order is not payable until fees are final.**

## Idempotency

- Record every event in `processed_events(stripe_event_id PRIMARY KEY)` **inside the same transaction as its effect**. Replays are no-ops.
- Verify the webhook signature before any parsing, on every endpoint.
- Ack fast (<500ms p95); queue heavy work.
- Out-of-order arrivals are normal: `charge.succeeded` before `checkout.session.completed` queues and retries.

## Idempotency key formats

| Operation | Key |
|---|---|
| Payout transfer | `payout:{payout_id}` |
| Refund | `refund:{order_id}` |
| Checkout session | `checkout:{product_id}:{client_reference}` |

## Events handled

`checkout.session.completed` · `charge.succeeded` · `charge.refunded` · `charge.dispute.created` · `charge.dispute.closed` · `transfer.failed` · `account.updated`

## The outbox rule

Nothing outbound ever happens inside a webhook transaction: an email or alert is a row written to `effect_outbox` in the same transaction as the money, and a separate drain worker sends it after commit — because a rolled-back transaction must un-happen completely, and you cannot un-send an email.

---

**Assume every webhook arrives more than once and out of order.**
