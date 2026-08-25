-- =====================================================================
-- ProductForge — Backend Schema
-- Postgres 16 / Supabase
-- Version 2.0 — matches PRD v2.0
--
-- Money rule: all amounts are BIGINT cents. No floats, anywhere, ever.
-- Ledger rule: ledger_entries is append-only. Corrections are new rows.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =====================================================================
-- 1. ENUMS
-- =====================================================================

CREATE TYPE kyc_status         AS ENUM ('none','pending','verified','restricted','rejected');
CREATE TYPE review_tier        AS ENUM ('full','spot','auto');
CREATE TYPE product_kind       AS ENUM ('single','bundle');
CREATE TYPE product_origin     AS ENUM ('generated','uploaded','mixed');
CREATE TYPE product_status     AS ENUM ('draft','live','restricted','removed');
CREATE TYPE review_state       AS ENUM ('pending','cleared','rejected');
CREATE TYPE asset_kind         AS ENUM ('file','link');
CREATE TYPE order_state        AS ENUM ('paid','refunded','disputed','reversed');
CREATE TYPE payout_state       AS ENUM ('pending','sent','failed');
CREATE TYPE dispute_state      AS ENUM ('needs_response','under_review','won','lost','warning_closed');
CREATE TYPE safety_result      AS ENUM ('pass','flag','fail');

CREATE TYPE ledger_type AS ENUM (
  'sale',              -- creator's share of an order
  'refund',            -- reversal of a sale
  'dispute',           -- reversal + fee on a chargeback
  'referral',          -- referrer's 5% of platform revenue
  'referral_reversal', -- paired reversal of a referral
  'reserve_hold',
  'reserve_release',
  'payout',            -- funds leaving to the creator
  'adjustment'         -- manual admin correction
);

CREATE TYPE delivery_event_type AS ENUM (
  'download','link_open','email_sent','email_opened','access_link_used'
);

-- =====================================================================
-- 2. IDENTITY
-- =====================================================================

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  name          text,
  avatar_url    text,
  is_creator    boolean NOT NULL DEFAULT false,
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE creators (
  user_id                 uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  handle                  citext NOT NULL UNIQUE,
  display_name            text NOT NULL,
  bio                     text,
  accent_token            text NOT NULL DEFAULT 'mint'
                            CHECK (accent_token IN ('mint','butter','blush','lilac','sky')),
  socials                 jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Stripe Connect
  stripe_account_id       text UNIQUE,
  country                 char(2),
  kyc_status              kyc_status NOT NULL DEFAULT 'none',

  -- Risk posture
  reserve_pct             numeric(5,4) NOT NULL DEFAULT 0.10
                            CHECK (reserve_pct >= 0 AND reserve_pct <= 1),
  reserve_until           timestamptz,
  payouts_paused          boolean NOT NULL DEFAULT false,
  tier                    review_tier NOT NULL DEFAULT 'full',
  min_price_cents         bigint NOT NULL DEFAULT 500 CHECK (min_price_cents >= 500),
  dispute_rate_30d        numeric(6,5) NOT NULL DEFAULT 0,
  dispute_rate_90d        numeric(6,5) NOT NULL DEFAULT 0,

  -- Referral. Set once at signup, immutable thereafter (trigger below).
  referred_by_creator_id  uuid REFERENCES creators(user_id) ON DELETE SET NULL,
  referral_expires_at     timestamptz,

  -- Fraud fingerprints
  signup_ip_hash          text,
  signup_device_hash      text,

  created_at              timestamptz NOT NULL DEFAULT now(),

  -- INVARIANT 6a: a creator can never refer themselves.
  CONSTRAINT no_self_referral CHECK (referred_by_creator_id IS DISTINCT FROM user_id),
  -- A referral window only exists if there is a referrer.
  CONSTRAINT referral_window_needs_referrer
    CHECK ((referred_by_creator_id IS NULL) = (referral_expires_at IS NULL))
);

CREATE INDEX idx_creators_referred_by ON creators(referred_by_creator_id)
  WHERE referred_by_creator_id IS NOT NULL;
CREATE INDEX idx_creators_device      ON creators(signup_device_hash)
  WHERE signup_device_hash IS NOT NULL;

-- =====================================================================
-- 3. CATALOGUE
-- =====================================================================

CREATE TABLE products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          uuid NOT NULL REFERENCES creators(user_id) ON DELETE RESTRICT,
  title               text NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  slug                citext NOT NULL,
  description         text,
  kind                product_kind   NOT NULL DEFAULT 'single',
  origin              product_origin NOT NULL DEFAULT 'uploaded',
  price_cents         bigint NOT NULL CHECK (price_cents >= 500),
  cover_key           text,
  status              product_status NOT NULL DEFAULT 'draft',
  review_state        review_state   NOT NULL DEFAULT 'pending',
  review_note         text,
  current_version_id  uuid,                       -- FK added after product_versions
  created_at          timestamptz NOT NULL DEFAULT now(),
  published_at        timestamptz,

  UNIQUE (creator_id, slug)
);

CREATE INDEX idx_products_creator ON products(creator_id);
CREATE INDEX idx_products_live    ON products(creator_id, status) WHERE status = 'live';
CREATE INDEX idx_products_review  ON products(review_state, created_at)
  WHERE review_state = 'pending';

CREATE TABLE product_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version       integer NOT NULL CHECK (version >= 1),
  changelog     text,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);

ALTER TABLE products
  ADD CONSTRAINT fk_products_current_version
  FOREIGN KEY (current_version_id) REFERENCES product_versions(id) ON DELETE SET NULL;

CREATE TABLE assets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id  uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  position            integer NOT NULL DEFAULT 0,
  kind                asset_kind NOT NULL,
  title               text NOT NULL,

  -- kind = 'file'
  format              text,
  file_key            text,
  file_size_bytes     bigint CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  checksum_sha256     text,

  -- kind = 'link'
  external_url        text,
  link_provider       text,

  created_at          timestamptz NOT NULL DEFAULT now(),

  -- An asset is exactly one of file or link. Never both, never neither.
  CONSTRAINT asset_shape CHECK (
    (kind = 'file' AND file_key IS NOT NULL AND external_url IS NULL)
    OR
    (kind = 'link' AND external_url IS NOT NULL AND file_key IS NULL)
  ),
  UNIQUE (product_version_id, position)
);

CREATE INDEX idx_assets_version ON assets(product_version_id);

CREATE TABLE bundle_items (
  bundle_product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  member_product_id  uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  position           integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_product_id, member_product_id),
  CONSTRAINT no_self_bundle CHECK (bundle_product_id <> member_product_id)
);

-- =====================================================================
-- 4. SAFETY & REVIEW
-- =====================================================================

CREATE TABLE safety_checks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id  uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  asset_id            uuid REFERENCES assets(id) ON DELETE CASCADE,
  check_type          text NOT NULL,   -- malware | integrity | url_reputation |
                                       -- prohibited_content | risk_claims | duplicate
  result              safety_result NOT NULL,
  detail              jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_safety_version ON safety_checks(product_version_id);
CREATE INDEX idx_safety_failed  ON safety_checks(result, ts) WHERE result <> 'pass';

CREATE TABLE reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reviewer_id  uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  outcome      review_state NOT NULL,
  note         text,
  ts           timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5. ATTRIBUTION
-- =====================================================================

CREATE TABLE links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  uuid NOT NULL REFERENCES creators(user_id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id) ON DELETE CASCADE,
  label       text NOT NULL,
  slug        citext NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE link_events (
  id          bigserial PRIMARY KEY,
  link_id     uuid NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL DEFAULT now(),
  ip_hash     text,
  user_agent  text,
  referrer    text
);

CREATE INDEX idx_link_events_link_ts ON link_events(link_id, ts DESC);

-- =====================================================================
-- 6. ORDERS
-- =====================================================================

CREATE TABLE orders (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id                 uuid REFERENCES users(id) ON DELETE SET NULL,
  buyer_email              citext NOT NULL,
  product_id               uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_version_id       uuid NOT NULL REFERENCES product_versions(id) ON DELETE RESTRICT,
  creator_id               uuid NOT NULL REFERENCES creators(user_id) ON DELETE RESTRICT,

  -- Money. See PRD 2.3: creator's 75% is of NET, after processing.
  gross_cents              bigint NOT NULL CHECK (gross_cents >= 500),
  tax_cents                bigint NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  processing_cents         bigint NOT NULL DEFAULT 0 CHECK (processing_cents >= 0),
  net_cents                bigint NOT NULL CHECK (net_cents >= 0),
  creator_cents            bigint NOT NULL CHECK (creator_cents >= 0),
  platform_cents           bigint NOT NULL CHECK (platform_cents >= 0),

  stripe_payment_intent_id text UNIQUE,
  source_link_id           uuid REFERENCES links(id) ON DELETE SET NULL,
  has_link_assets          boolean NOT NULL DEFAULT false,
  link_assets_only         boolean NOT NULL DEFAULT false,

  matures_at               timestamptz NOT NULL,
  state                    order_state NOT NULL DEFAULT 'paid',
  created_at               timestamptz NOT NULL DEFAULT now(),

  -- The split must reconcile exactly. Off-by-one cents are bugs, not rounding.
  CONSTRAINT split_balances CHECK (creator_cents + platform_cents = net_cents),
  CONSTRAINT net_balances   CHECK (net_cents = gross_cents - processing_cents)
);

CREATE INDEX idx_orders_creator_ts ON orders(creator_id, created_at DESC);
CREATE INDEX idx_orders_product    ON orders(product_id);
CREATE INDEX idx_orders_link       ON orders(source_link_id) WHERE source_link_id IS NOT NULL;
CREATE INDEX idx_orders_payable    ON orders(creator_id, matures_at)
  WHERE state = 'paid';
CREATE INDEX idx_orders_buyer      ON orders(buyer_email);

CREATE TABLE delivery_events (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  asset_id    uuid REFERENCES assets(id) ON DELETE SET NULL,
  type        delivery_event_type NOT NULL,
  ts          timestamptz NOT NULL DEFAULT now(),
  ip_hash     text,
  user_agent  text
);

CREATE INDEX idx_delivery_order ON delivery_events(order_id, ts);

CREATE TABLE disputes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  stripe_dispute_id     text NOT NULL UNIQUE,
  reason                text,
  amount_cents          bigint NOT NULL CHECK (amount_cents >= 0),
  state                 dispute_state NOT NULL DEFAULT 'needs_response',
  evidence_due_at       timestamptz,
  evidence_submitted_at timestamptz,
  outcome               text,
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_disputes_due ON disputes(evidence_due_at)
  WHERE state = 'needs_response';

-- =====================================================================
-- 7. LEDGER  — append-only, single source of truth for all money
-- =====================================================================

CREATE TABLE ledger_entries (
  id                       bigserial PRIMARY KEY,
  creator_id               uuid NOT NULL REFERENCES creators(user_id) ON DELETE RESTRICT,
  order_id                 uuid REFERENCES orders(id) ON DELETE RESTRICT,
  payout_id                uuid,                     -- FK added after payouts
  type                     ledger_type NOT NULL,
  amount_cents             bigint NOT NULL,          -- signed: credits +, debits -
  -- For type='referral'/'referral_reversal': whose sale generated this.
  referral_of_creator_id   uuid REFERENCES creators(user_id) ON DELETE RESTRICT,
  memo                     text,
  ts                       timestamptz NOT NULL DEFAULT now(),

  -- INVARIANT 5: referral rows must name the creator they derive from,
  -- and non-referral rows must not.
  CONSTRAINT referral_shape CHECK (
    (type IN ('referral','referral_reversal') AND referral_of_creator_id IS NOT NULL)
    OR
    (type NOT IN ('referral','referral_reversal') AND referral_of_creator_id IS NULL)
  ),
  -- A referral can never be self-referential.
  CONSTRAINT referral_not_self CHECK (referral_of_creator_id IS DISTINCT FROM creator_id),
  -- Sign discipline: these types are always debits.
  CONSTRAINT sign_debits CHECK (
    type NOT IN ('refund','dispute','referral_reversal','reserve_hold','payout')
    OR amount_cents <= 0
  ),
  CONSTRAINT sign_credits CHECK (
    type NOT IN ('sale','referral','reserve_release') OR amount_cents >= 0
  )
);

CREATE INDEX idx_ledger_creator_ts ON ledger_entries(creator_id, ts DESC);
CREATE INDEX idx_ledger_order      ON ledger_entries(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_ledger_payout     ON ledger_entries(payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX idx_ledger_unpaid     ON ledger_entries(creator_id, type)
  WHERE payout_id IS NULL;

-- INVARIANT 1: append-only. Block UPDATE and DELETE at the table level.
CREATE OR REPLACE FUNCTION ledger_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % rejected. Write a correcting entry instead.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_no_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_is_append_only();

CREATE TRIGGER trg_ledger_no_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_is_append_only();

-- =====================================================================
-- 8. PAYOUTS
-- =====================================================================

CREATE TABLE payouts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id             uuid NOT NULL REFERENCES creators(user_id) ON DELETE RESTRICT,
  period_start           timestamptz NOT NULL,
  period_end             timestamptz NOT NULL,
  sales_cents            bigint NOT NULL DEFAULT 0,
  referral_cents         bigint NOT NULL DEFAULT 0,
  clawed_cents           bigint NOT NULL DEFAULT 0,
  reserve_held_cents     bigint NOT NULL DEFAULT 0,
  reserve_released_cents bigint NOT NULL DEFAULT 0,
  net_cents              bigint NOT NULL CHECK (net_cents >= 0),
  stripe_transfer_id     text UNIQUE,
  state                  payout_state NOT NULL DEFAULT 'pending',
  failure_reason         text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  sent_at                timestamptz,

  CONSTRAINT period_ordered CHECK (period_end > period_start)
);

ALTER TABLE ledger_entries
  ADD CONSTRAINT fk_ledger_payout
  FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE RESTRICT;

CREATE INDEX idx_payouts_creator ON payouts(creator_id, created_at DESC);
CREATE INDEX idx_payouts_pending ON payouts(state) WHERE state = 'pending';

-- =====================================================================
-- 9. BALANCE VIEWS  — INVARIANT 2: balance is always SUM(ledger), never stored
-- =====================================================================

CREATE VIEW creator_balances AS
SELECT
  c.user_id AS creator_id,
  COALESCE(SUM(l.amount_cents), 0)                                        AS balance_cents,
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.payout_id IS NULL), 0)     AS unpaid_cents,
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.type = 'reserve_hold'), 0) AS reserve_cents
FROM creators c
LEFT JOIN ledger_entries l ON l.creator_id = c.user_id
GROUP BY c.user_id;

-- Orders eligible to enter a payout.
-- INVARIANT 4: matured AND the product's review has cleared.
CREATE VIEW payable_orders AS
SELECT o.*
FROM orders o
JOIN products p ON p.id = o.product_id
WHERE o.state = 'paid'
  AND o.matures_at <= now()
  AND p.review_state = 'cleared';

-- =====================================================================
-- 10. GUARDS
-- =====================================================================

-- INVARIANT 6: referred_by_creator_id is set once and never changed.
CREATE OR REPLACE FUNCTION referrer_is_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.referred_by_creator_id IS NOT NULL
     AND NEW.referred_by_creator_id IS DISTINCT FROM OLD.referred_by_creator_id THEN
    RAISE EXCEPTION 'referred_by_creator_id is immutable once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referrer_immutable
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION referrer_is_immutable();

-- INVARIANT 6b: SINGLE TIER, PERMANENTLY.
-- A creator who was themselves referred cannot appear as someone's referrer.
-- This makes tier 2 unrepresentable in the database, not merely discouraged.
CREATE OR REPLACE FUNCTION enforce_single_tier_referral() RETURNS trigger AS $$
DECLARE
  referrer_was_referred uuid;
BEGIN
  IF NEW.referred_by_creator_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT referred_by_creator_id INTO referrer_was_referred
  FROM creators WHERE user_id = NEW.referred_by_creator_id;

  IF referrer_was_referred IS NOT NULL THEN
    RAISE EXCEPTION
      'Single-tier referral only: creator % was themselves referred and cannot refer others',
      NEW.referred_by_creator_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_tier_referral
  BEFORE INSERT OR UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION enforce_single_tier_referral();

-- Price floor is per-creator (risk tooling can raise it above $5).
CREATE OR REPLACE FUNCTION enforce_creator_price_floor() RETURNS trigger AS $$
DECLARE
  floor_cents bigint;
BEGIN
  SELECT min_price_cents INTO floor_cents FROM creators WHERE user_id = NEW.creator_id;
  IF NEW.price_cents < floor_cents THEN
    RAISE EXCEPTION 'Price %c is below this creator''s floor of %c',
      NEW.price_cents, floor_cents;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_price_floor
  BEFORE INSERT OR UPDATE OF price_cents ON products
  FOR EACH ROW EXECUTE FUNCTION enforce_creator_price_floor();

-- A new creator's first three products may not be link-only (PRD 2.2):
-- link assets produce no download evidence and cannot be revoked.
CREATE OR REPLACE FUNCTION guard_link_only_products() RETURNS trigger AS $$
DECLARE
  file_assets int;
  cleared     int;
BEGIN
  SELECT count(*) INTO file_assets
  FROM assets a
  JOIN product_versions pv ON pv.id = a.product_version_id
  JOIN products p ON p.id = pv.product_id
  WHERE p.id = NEW.id AND a.kind = 'file';

  IF NEW.status = 'live' AND file_assets = 0 THEN
    SELECT count(*) INTO cleared
    FROM products
    WHERE creator_id = NEW.creator_id AND review_state = 'cleared';

    IF cleared < 3 THEN
      RAISE EXCEPTION
        'Link-only products require 3 cleared products first (creator has %)', cleared;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_link_only_guard
  BEFORE UPDATE OF status ON products
  FOR EACH ROW WHEN (NEW.status = 'live')
  EXECUTE FUNCTION guard_link_only_products();

-- =====================================================================
-- 11. ROW LEVEL SECURITY
-- Supabase: auth.uid() returns the authenticated user's uuid.
-- These policies assume a shim; in Supabase replace current_user_id() with auth.uid().
-- =====================================================================

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT COALESCE((SELECT is_admin FROM users WHERE id = current_user_id()), false);
$$ LANGUAGE sql STABLE;

ALTER TABLE creators         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE links            ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes         ENABLE ROW LEVEL SECURITY;

-- Creators read and update only their own row.
CREATE POLICY creators_self ON creators
  FOR SELECT USING (user_id = current_user_id() OR is_admin());
CREATE POLICY creators_update_self ON creators
  FOR UPDATE USING (user_id = current_user_id() OR is_admin());

-- Products: creators manage their own; anyone may read live ones (storefront).
CREATE POLICY products_own ON products
  FOR ALL USING (creator_id = current_user_id() OR is_admin())
  WITH CHECK (creator_id = current_user_id() OR is_admin());
CREATE POLICY products_public_read ON products
  FOR SELECT USING (status = 'live');

CREATE POLICY versions_own ON product_versions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_versions.product_id
      AND (p.creator_id = current_user_id() OR is_admin())));

CREATE POLICY assets_own ON assets
  FOR ALL USING (EXISTS (
    SELECT 1 FROM product_versions pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = assets.product_version_id
      AND (p.creator_id = current_user_id() OR is_admin())));

-- Orders: the selling creator, the buyer, or an admin.
CREATE POLICY orders_visible ON orders
  FOR SELECT USING (
    creator_id = current_user_id()
    OR buyer_id = current_user_id()
    OR is_admin());

-- Money surfaces are read-only to creators. Writes are service-role only.
CREATE POLICY ledger_own ON ledger_entries
  FOR SELECT USING (creator_id = current_user_id() OR is_admin());
CREATE POLICY payouts_own ON payouts
  FOR SELECT USING (creator_id = current_user_id() OR is_admin());

CREATE POLICY links_own ON links
  FOR ALL USING (creator_id = current_user_id() OR is_admin())
  WITH CHECK (creator_id = current_user_id() OR is_admin());

CREATE POLICY delivery_visible ON delivery_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = delivery_events.order_id
      AND (o.creator_id = current_user_id() OR o.buyer_id = current_user_id() OR is_admin())));

CREATE POLICY disputes_visible ON disputes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = disputes.order_id
      AND (o.creator_id = current_user_id() OR is_admin())));
