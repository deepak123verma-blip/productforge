import type {
  AccountUpdated,
  ChargeRefunded,
  ChargeSucceeded,
  CheckoutSessionCompleted,
  DisputeClosed,
  DisputeCreated,
  OrderFactsForEvents,
  TransferFailed,
} from "../../../lib/stripe/events/types";

/**
 * Hand-written from Stripe's documented event shapes (TRD §10).
 * TODO(phase-2): replace with real recordings from `stripe listen`.
 * The canonical order: $29.00 gross, $1.14 processing → 2089 / 697.
 */

export const checkoutCompleted: CheckoutSessionCompleted = {
  id: "evt_checkout_001",
  type: "checkout.session.completed",
  data: {
    sessionId: "cs_test_001",
    paymentIntentId: "pi_001",
    customerEmail: "riya@example.com",
    amountTotalCents: 3132, // 2900 gross + 232 tax
    amountTaxCents: 232,
    metadata: { productId: "p-1", productVersionId: "pv-1", sourceLinkId: "l-1" },
  },
};

export const chargeSucceeded: ChargeSucceeded = {
  id: "evt_charge_001",
  type: "charge.succeeded",
  data: { paymentIntentId: "pi_001", processingFeeCents: 114 },
};

export const chargeRefunded: ChargeRefunded = {
  id: "evt_refund_001",
  type: "charge.refunded",
  data: { paymentIntentId: "pi_001" },
};

export const disputeCreated: DisputeCreated = {
  id: "evt_dispute_001",
  type: "charge.dispute.created",
  data: {
    disputeId: "dp_001",
    paymentIntentId: "pi_001",
    amountCents: 2900,
    reason: "fraudulent",
    evidenceDueAt: "2026-09-10T00:00:00Z",
  },
};

export const disputeWon: DisputeClosed = {
  id: "evt_dispute_won_001",
  type: "charge.dispute.closed",
  data: { disputeId: "dp_001", paymentIntentId: "pi_001", status: "won" },
};

export const disputeLost: DisputeClosed = {
  id: "evt_dispute_lost_001",
  type: "charge.dispute.closed",
  data: { disputeId: "dp_001", paymentIntentId: "pi_001", status: "lost" },
};

export const transferFailed: TransferFailed = {
  id: "evt_transfer_001",
  type: "transfer.failed",
  data: { transferId: "tr_001", failureMessage: "The destination bank account has been closed." },
};

export const accountUpdated: AccountUpdated = {
  id: "evt_account_001",
  type: "account.updated",
  data: { accountId: "acct_001", detailsSubmitted: true, payoutsEnabled: true, disabledReason: null },
};

export const paidOrder: OrderFactsForEvents = {
  id: "order-1",
  creatorId: "seller",
  buyerEmail: "riya@example.com",
  grossCents: 2900,
  feesFinal: false,
  state: "paid",
  hasLinkAssets: true,
};
