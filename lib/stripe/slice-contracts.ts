/**
 * The state-slice contract (ruling A3): each handler's state slice is the
 * real interface between pure logic and the executor's lookups. Every
 * lookup below must be a SINGLE INDEXED read — tests/webhooks/
 * slice-contracts.test.ts asserts each named index/constraint exists in
 * the migrations. A slice needing a >2-table join is a design smell and
 * goes to OPEN-QUESTIONS.md.
 */

export interface SliceLookup {
  slice: string;
  field: string;
  query: string; // the exact lookup the executor runs
  table: string;
  /** The index or constraint that makes it one indexed read. */
  index: string;
}

export const sliceContracts: SliceLookup[] = [
  {
    slice: "CheckoutCompletedState",
    field: "orderExists",
    query: "SELECT 1 FROM orders WHERE stripe_payment_intent_id = $pi",
    table: "orders",
    index: "stripe_payment_intent_id text UNIQUE",
  },
  {
    slice: "CheckoutCompletedState",
    field: "product",
    query: "SELECT ... FROM products WHERE id = $metadata.productId (assets flags come from the current version: one indexed read on idx_assets_version)",
    table: "products",
    index: "PRIMARY KEY",
  },
  {
    slice: "CheckoutCompletedState",
    field: "sourceLinkExists",
    query: "SELECT 1 FROM links WHERE id = $metadata.sourceLinkId",
    table: "links",
    index: "PRIMARY KEY",
  },
  {
    slice: "ChargeSucceededState / ChargeRefundedState / DisputeCreatedState",
    field: "order",
    query: "SELECT ... FROM orders WHERE stripe_payment_intent_id = $pi",
    table: "orders",
    index: "stripe_payment_intent_id text UNIQUE",
  },
  {
    slice: "ChargeSucceededState",
    field: "referral.activeReferrerId",
    query: "SELECT referred_by_creator_id FROM creators WHERE user_id = $order.creator_id AND referral_expires_at > now()",
    table: "creators",
    index: "PRIMARY KEY",
  },
  {
    slice: "ChargeRefundedState / DisputeCreatedState",
    field: "saleEntries",
    query: "SELECT ... FROM ledger_entries WHERE order_id = $order.id",
    table: "ledger_entries",
    index: "idx_ledger_order",
  },
  {
    slice: "DisputeCreatedState / DisputeClosedState",
    field: "disputeExists / alreadyResolved",
    query: "SELECT ... FROM disputes WHERE stripe_dispute_id = $disputeId",
    table: "disputes",
    index: "stripe_dispute_id text NOT NULL UNIQUE",
  },
  {
    slice: "TransferFailedState",
    field: "payoutId",
    query: "SELECT id, state FROM payouts WHERE stripe_transfer_id = $transferId",
    table: "payouts",
    index: "stripe_transfer_id     text UNIQUE",
  },
  {
    slice: "AccountUpdatedState",
    field: "creatorId / currentKycStatus",
    query: "SELECT user_id, kyc_status FROM creators WHERE stripe_account_id = $accountId",
    table: "creators",
    index: "stripe_account_id       text UNIQUE",
  },
  {
    slice: "(idempotency)",
    field: "processedEventIds",
    query: "SELECT 1 FROM processed_events WHERE stripe_event_id = $eventId",
    table: "processed_events",
    index: "stripe_event_id  text PRIMARY KEY",
  },
];
