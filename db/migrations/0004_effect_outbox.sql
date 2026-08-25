-- =====================================================================
-- ProductForge — Migration 0004: post-commit effect outbox
--
-- Why (ruling A1): SendEmail / any outbound call inside a webhook
-- transaction is a correctness bug — email is not transactional. The
-- executor writes outbound intents to this table IN THE SAME TRANSACTION
-- as the event's DB effects; a drain worker sends them after commit.
-- The executor never makes an outbound call. Ever.
--
--   pending ──drain──► sent
--      │ (attempt fails: attempts+1, last_error, next_attempt_at)
--      └──after max attempts──► abandoned  (terminal, error retained)
--
-- NOTE: apply with plain psql autocommit (never psql -1).
-- =====================================================================

CREATE TYPE outbox_state AS ENUM ('pending','sent','failed','abandoned');

CREATE TABLE effect_outbox (
  id               bigserial PRIMARY KEY,
  effect_type      text NOT NULL,          -- 'SendEmail' | 'AlertAdmin' | ...
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  state            outbox_state NOT NULL DEFAULT 'pending',
  attempts         int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error       text,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz
);

-- The drain query: oldest due work first.
CREATE INDEX idx_outbox_drain ON effect_outbox(state, created_at)
  WHERE state IN ('pending','failed');

-- State discipline:
--  * reaching 'sent' requires at least one attempt (a send IS an attempt);
--  * 'sent' and 'abandoned' are terminal;
--  * 'abandoned' must retain the error that killed it.
CREATE OR REPLACE FUNCTION outbox_state_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.state IN ('sent','abandoned') AND NEW.state IS DISTINCT FROM OLD.state THEN
      RAISE EXCEPTION 'outbox row in terminal state % cannot transition to %', OLD.state, NEW.state;
    END IF;
    IF NEW.state = 'sent' AND NEW.attempts < 1 THEN
      RAISE EXCEPTION 'an outbox row cannot be sent with zero attempts — the send is an attempt';
    END IF;
    IF NEW.state = 'abandoned' AND NEW.last_error IS NULL THEN
      RAISE EXCEPTION 'abandoning an outbox row requires last_error';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_state
  BEFORE UPDATE ON effect_outbox
  FOR EACH ROW EXECUTE FUNCTION outbox_state_guard();

-- Service-role only (the executor and the drain worker).
ALTER TABLE effect_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_admin_read ON effect_outbox
  FOR SELECT USING (is_admin());
