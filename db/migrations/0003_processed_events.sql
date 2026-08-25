-- =====================================================================
-- ProductForge — Migration 0003: webhook idempotency + strict debit signs
--
-- Why:
--   1. TRD §3.5: every Stripe webhook is recorded in processed_events
--      INSIDE THE SAME TRANSACTION as its effect, making replays no-ops.
--      Stripe retries for three days; every event arrives more than once
--      and out of order.
--   2. Ruling A4: sign_debits allowed zero-amount debit rows (<= 0).
--      Debits are now strictly negative — a 0¢ refund/payout row is noise
--      that can hide a bug. Genuine zero-value traces go through
--      'adjustment' with a memo.
--
-- NOTE: apply with plain psql autocommit (never psql -1).
-- =====================================================================

CREATE TABLE processed_events (
  stripe_event_id  text PRIMARY KEY,
  event_type       text NOT NULL,
  processed_at     timestamptz NOT NULL DEFAULT now()
);

-- Service-role only: webhooks are the only writer, nothing user-facing reads it.
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY processed_events_admin_read ON processed_events
  FOR SELECT USING (is_admin());

-- Tighten sign discipline: debit types strictly negative.
ALTER TABLE ledger_entries DROP CONSTRAINT sign_debits;
ALTER TABLE ledger_entries ADD CONSTRAINT sign_debits CHECK (
  type NOT IN ('refund','dispute','referral_reversal','reserve_hold','payout')
  OR amount_cents < 0
);
