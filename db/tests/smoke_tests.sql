-- ProductForge schema smoke tests
-- Each test asserts one invariant. Any failure aborts the run.
-- 37 tests: 01-27 (incl. 19b) cover migration 0001; 29-31 cover migration 0002;
-- 32-34 cover migration 0003; 35-37 cover migration 0004.

\set ON_ERROR_STOP on
SET client_min_messages TO WARNING;

CREATE OR REPLACE FUNCTION must_fail(sql text, label text) RETURNS text AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN others THEN
    RETURN 'PASS  ' || label;
  END;
  RAISE EXCEPTION 'FAIL  % — statement was allowed but should have been rejected', label;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION must_pass(sql text, label text) RETURNS text AS $$
BEGIN
  EXECUTE sql;
  RETURN 'PASS  ' || label;
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'FAIL  % — %', label, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- fixtures
INSERT INTO users (id, email, is_creator) VALUES
  ('11111111-1111-1111-1111-111111111111','alice@test.com', true),
  ('22222222-2222-2222-2222-222222222222','bob@test.com',   true),
  ('33333333-3333-3333-3333-333333333333','carol@test.com', true),
  ('44444444-4444-4444-4444-444444444444','buyer@test.com', false),
  ('55555555-5555-5555-5555-555555555555','dave@test.com',  true);

INSERT INTO creators (user_id, handle, display_name) VALUES
  ('11111111-1111-1111-1111-111111111111','alice','Alice'),
  ('55555555-5555-5555-5555-555555555555','dave','Dave');

-- Bob is referred by Alice. Legal: Alice was not herself referred.
INSERT INTO creators (user_id, handle, display_name, referred_by_creator_id, referral_expires_at)
VALUES ('22222222-2222-2222-2222-222222222222','bob','Bob',
        '11111111-1111-1111-1111-111111111111', now() + interval '12 months');

INSERT INTO products (id, creator_id, title, slug, price_cents, status, review_state)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'Test Kit','test-kit', 2900, 'live', 'cleared');

INSERT INTO product_versions (id, product_id, version)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 1);

UPDATE products SET current_version_id = 'bbbbbbbb-0000-0000-0000-000000000001'
WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------- tests
SELECT must_pass($$
  INSERT INTO assets (product_version_id, position, kind, title, format, file_key, file_size_bytes)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 0, 'file','Guide','pdf','k/guide.pdf', 900000)
$$, '01  file asset with file_key is accepted');

SELECT must_fail($$
  INSERT INTO assets (product_version_id, position, kind, title, file_key, external_url)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 1, 'file','Bad','k/x.pdf','https://x.com')
$$, '02  asset cannot be both file and link');

SELECT must_fail($$
  INSERT INTO assets (product_version_id, position, kind, title)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 2, 'link','No URL')
$$, '03  link asset without a URL is rejected');

SELECT must_fail($$
  INSERT INTO products (creator_id, title, slug, price_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','Cheap','cheap', 199)
$$, '04  price below the $5 floor is rejected');

SELECT must_fail($$
  UPDATE creators SET min_price_cents = 900
   WHERE user_id = '11111111-1111-1111-1111-111111111111';
  INSERT INTO products (creator_id, title, slug, price_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','Under','under', 500)
$$, '05  price below a raised per-creator floor is rejected');

-- Order maths: $29.00 gross, $1.14 processing -> $27.86 net
-- -> creator floor(2786 * 0.75) = 2089, platform 697 (ruling A3 / D5 fix)
SELECT must_pass($$
  INSERT INTO orders (id, buyer_email, product_id, product_version_id, creator_id,
                      gross_cents, processing_cents, net_cents, creator_cents, platform_cents,
                      matures_at)
  VALUES ('cccccccc-0000-0000-0000-000000000001','buyer@test.com',
          'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          2900, 114, 2786, 2089, 697, now() + interval '14 days')
$$, '06  a balanced order is accepted');

SELECT must_fail($$
  INSERT INTO orders (buyer_email, product_id, product_version_id, creator_id,
                      gross_cents, processing_cents, net_cents, creator_cents, platform_cents,
                      matures_at)
  VALUES ('buyer@test.com','aaaaaaaa-0000-0000-0000-000000000001',
          'bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
          2900, 114, 2786, 2089, 999, now())
$$, '07  order whose split does not reconcile is rejected');

SELECT must_fail($$
  INSERT INTO orders (buyer_email, product_id, product_version_id, creator_id,
                      gross_cents, processing_cents, net_cents, creator_cents, platform_cents,
                      matures_at)
  VALUES ('buyer@test.com','aaaaaaaa-0000-0000-0000-000000000001',
          'bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
          2900, 114, 2800, 2100, 700, now())
$$, '08  order whose net does not equal gross minus processing is rejected');

SELECT must_pass($$
  INSERT INTO ledger_entries (creator_id, order_id, type, amount_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','sale', 2089)
$$, '09  a sale ledger entry is accepted');

SELECT must_fail($$
  UPDATE ledger_entries SET amount_cents = 9999 WHERE type = 'sale'
$$, '10  ledger rows cannot be updated');

SELECT must_fail($$
  DELETE FROM ledger_entries WHERE type = 'sale'
$$, '11  ledger rows cannot be deleted');

SELECT must_fail($$
  INSERT INTO ledger_entries (creator_id, order_id, type, amount_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','refund', 500)
$$, '12  a refund must be negative');

SELECT must_fail($$
  INSERT INTO ledger_entries (creator_id, order_id, type, amount_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','sale', -100)
$$, '13  a sale must be positive');

SELECT must_fail($$
  INSERT INTO ledger_entries (creator_id, type, amount_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','referral', 50)
$$, '14  a referral entry must name the creator it derives from');

SELECT must_fail($$
  INSERT INTO ledger_entries (creator_id, type, amount_cents, referral_of_creator_id)
  VALUES ('11111111-1111-1111-1111-111111111111','referral', 50,
          '11111111-1111-1111-1111-111111111111')
$$, '15  a creator cannot earn a referral from themselves');

SELECT must_pass($$
  INSERT INTO ledger_entries (creator_id, type, amount_cents, referral_of_creator_id, memo)
  VALUES ('11111111-1111-1111-1111-111111111111','referral', 34,
          '22222222-2222-2222-2222-222222222222','5% of platform revenue: floor(697 * 0.05)')
$$, '16  a valid referral entry is accepted');

-- THE BIG ONE: single tier, permanently.
SELECT must_fail($$
  INSERT INTO creators (user_id, handle, display_name, referred_by_creator_id, referral_expires_at)
  VALUES ('33333333-3333-3333-3333-333333333333','carol','Carol',
          '22222222-2222-2222-2222-222222222222', now() + interval '12 months')
$$, '17  tier 2 is impossible: a referred creator cannot refer others');

SELECT must_fail($$
  INSERT INTO creators (user_id, handle, display_name, referred_by_creator_id, referral_expires_at)
  VALUES ('33333333-3333-3333-3333-333333333333','carol2','Carol',
          '33333333-3333-3333-3333-333333333333', now())
$$, '18  a creator cannot refer themselves');

SELECT must_fail($$
  UPDATE creators SET referred_by_creator_id = '55555555-5555-5555-5555-555555555555'
   WHERE user_id = '22222222-2222-2222-2222-222222222222'
$$, '19  once set, a referrer cannot be reassigned');

SELECT must_fail($$
  UPDATE creators SET referred_by_creator_id = NULL
   WHERE user_id = '22222222-2222-2222-2222-222222222222'
$$, '19b once set, a referrer cannot be cleared');

SELECT must_fail($$
  INSERT INTO creators (user_id, handle, display_name, referral_expires_at)
  VALUES ('33333333-3333-3333-3333-333333333333','carol3','Carol', now())
$$, '20  a referral window cannot exist without a referrer');

SELECT must_fail($$
  INSERT INTO bundle_items (bundle_product_id, member_product_id)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')
$$, '21  a bundle cannot contain itself');

-- Balance is derived, and reflects sale + referral
SELECT must_pass($$
  DO $x$
  DECLARE b bigint;
  BEGIN
    SELECT balance_cents INTO b FROM creator_balances
     WHERE creator_id = '11111111-1111-1111-1111-111111111111';
    IF b <> 2123 THEN
      RAISE EXCEPTION 'expected balance 2123 (2089 sale + 34 referral), got %', b;
    END IF;
  END $x$;
$$, '22  creator balance is derived from the ledger');

-- Immature order must not be payable
SELECT must_pass($$
  DO $x$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM payable_orders
     WHERE id = 'cccccccc-0000-0000-0000-000000000001';
    IF n <> 0 THEN RAISE EXCEPTION 'immature order appeared as payable'; END IF;
  END $x$;
$$, '23  an order before T+14 is not payable');

-- Matured but review pending must not be payable
SELECT must_pass($$
  DO $x$
  DECLARE n int;
  BEGIN
    UPDATE orders SET matures_at = now() - interval '1 day'
     WHERE id = 'cccccccc-0000-0000-0000-000000000001';
    UPDATE products SET review_state = 'pending'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
    SELECT count(*) INTO n FROM payable_orders
     WHERE id = 'cccccccc-0000-0000-0000-000000000001';
    IF n <> 0 THEN RAISE EXCEPTION 'order with pending review appeared as payable'; END IF;
  END $x$;
$$, '24  a matured order with pending review is not payable');

-- Matured AND cleared becomes payable
SELECT must_pass($$
  DO $x$
  DECLARE n int;
  BEGIN
    UPDATE products SET review_state = 'cleared'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
    SELECT count(*) INTO n FROM payable_orders
     WHERE id = 'cccccccc-0000-0000-0000-000000000001';
    IF n <> 1 THEN RAISE EXCEPTION 'matured cleared order should be payable, got %', n; END IF;
  END $x$;
$$, '25  a matured, review-cleared order is payable');

SELECT must_fail($$
  INSERT INTO payouts (creator_id, period_start, period_end, net_cents)
  VALUES ('11111111-1111-1111-1111-111111111111', now(), now() - interval '1 day', 100)
$$, '26  a payout period cannot end before it starts');

SELECT must_fail($$
  INSERT INTO products (creator_id, title, slug, price_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','Test Kit','test-kit', 2900)
$$, '27  a creator cannot reuse a product slug');

-- ---------------------------------------------------------------- 0002: payout state machine
-- Fixture payout in state 'pending'
INSERT INTO payouts (id, creator_id, period_start, period_end, net_cents)
VALUES ('dddddddd-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        now() - interval '7 days', now(), 2089);

SELECT must_fail($$
  UPDATE payouts SET state = 'executing'
   WHERE id = 'dddddddd-0000-0000-0000-000000000001'
$$, '29  a payout cannot reach executing without passing through confirmed');

SELECT must_fail($$
  UPDATE payouts SET state = 'confirmed'
   WHERE id = 'dddddddd-0000-0000-0000-000000000001'
$$, '30  confirming a payout requires confirmed_at and confirmed_by');

SELECT must_pass($$
  UPDATE payouts SET state = 'confirmed',
                     confirmed_at = now(),
                     confirmed_by = '44444444-4444-4444-4444-444444444444'
   WHERE id = 'dddddddd-0000-0000-0000-000000000001';
  UPDATE payouts SET state = 'executing'
   WHERE id = 'dddddddd-0000-0000-0000-000000000001';
  UPDATE payouts SET state = 'sent', sent_at = now()
   WHERE id = 'dddddddd-0000-0000-0000-000000000001'
$$, '31  the legal path pending -> confirmed -> executing -> sent is accepted');

-- ---------------------------------------------------------------- 0003: idempotency + strict debits
-- fixture: first sighting of the event
INSERT INTO processed_events (stripe_event_id, event_type)
VALUES ('evt_smoke_001', 'checkout.session.completed');

SELECT must_fail($$
  INSERT INTO processed_events (stripe_event_id, event_type)
  VALUES ('evt_smoke_001', 'checkout.session.completed')
$$, '32  a duplicate stripe event id is rejected');

SELECT must_fail($$
  INSERT INTO ledger_entries (creator_id, order_id, type, amount_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','refund', 0)
$$, '33  a zero-amount refund is rejected');

SELECT must_pass($$
  INSERT INTO ledger_entries (creator_id, order_id, type, amount_cents)
  VALUES ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','refund', -2089)
$$, '34  a negative refund is accepted');

-- ---------------------------------------------------------------- 0004: effect outbox
-- fixtures: one pending row, one on its way to abandoned
INSERT INTO effect_outbox (id, effect_type, payload)
VALUES (9001, 'SendEmail', '{"template":"delivery"}'::jsonb);
INSERT INTO effect_outbox (id, effect_type, payload, attempts, last_error, state)
VALUES (9002, 'SendEmail', '{}'::jsonb, 5, 'smtp timeout', 'abandoned');

SELECT must_fail($$
  UPDATE effect_outbox SET state = 'sent' WHERE id = 9001
$$, '35  an outbox row cannot reach sent without attempts incrementing');

SELECT must_fail($$
  UPDATE effect_outbox SET state = 'pending' WHERE id = 9002
$$, '36  abandoned is terminal');

SELECT must_pass($$
  DO $x$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM effect_outbox
     WHERE state IN ('pending','failed') AND next_attempt_at <= now() AND id = 9001;
    IF n <> 1 THEN RAISE EXCEPTION 'pending row invisible to the drain query'; END IF;
    -- and the legal path works: attempt, then sent
    UPDATE effect_outbox SET attempts = 1, state = 'sent', processed_at = now() WHERE id = 9001;
  END $x$;
$$, '37  a pending row is visible to the drain and sends after an attempt');
