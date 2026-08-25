-- =====================================================================
-- ProductForge — Migration 0002: payout state machine
--
-- Why: payout_state('pending'|'sent'|'failed') cannot distinguish
-- "preview written, awaiting human confirmation" from "confirmed,
-- transfer in flight". A crash mid-run leaves rows ambiguous.
--
-- Target machine:
--   pending → confirmed → executing → sent
--                             └────→ failed   (retried next run)
--
-- NOTE: ALTER TYPE ... ADD VALUE must not run inside a wrapping
-- transaction that also uses the new value. Apply this file with plain
-- psql autocommit (never `psql -1` / --single-transaction).
-- =====================================================================

ALTER TYPE payout_state ADD VALUE IF NOT EXISTS 'confirmed' BEFORE 'sent';
ALTER TYPE payout_state ADD VALUE IF NOT EXISTS 'executing' BEFORE 'sent';

ALTER TABLE payouts
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmed_by uuid REFERENCES users(id) ON DELETE RESTRICT;

-- State-machine guard: only forward transitions along the machine above.
-- 'sent' and 'failed' are terminal for the run; a failed payout is
-- retried as a NEW payouts row in the next run, never re-driven.
CREATE OR REPLACE FUNCTION payout_state_transitions() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'pending' THEN
      RAISE EXCEPTION 'payouts must be created in state pending, got %', NEW.state;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: no state change is always allowed.
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  IF OLD.state = 'pending' AND NEW.state = 'confirmed' THEN
    IF NEW.confirmed_at IS NULL OR NEW.confirmed_by IS NULL THEN
      RAISE EXCEPTION 'confirming a payout requires confirmed_at and confirmed_by';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.state = 'confirmed' AND NEW.state = 'executing' THEN
    RETURN NEW;
  END IF;

  IF OLD.state = 'executing' AND NEW.state IN ('sent','failed') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'illegal payout state transition % -> %', OLD.state, NEW.state;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payout_state_machine
  BEFORE INSERT OR UPDATE OF state ON payouts
  FOR EACH ROW EXECUTE FUNCTION payout_state_transitions();

-- Once confirmed, the confirmation record is immutable.
CREATE OR REPLACE FUNCTION payout_confirmation_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.confirmed_at IS NOT NULL
     AND (NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
          OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by) THEN
    RAISE EXCEPTION 'payout confirmation is immutable once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payout_confirmation_immutable
  BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION payout_confirmation_immutable();
