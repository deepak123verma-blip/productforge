import type { LedgerEntryDraft } from "../../money/ledger";

/**
 * The webhook boundary (sprint rule): handlers are PURE —
 * (event, currentState) → Effect[]. An Effect is a described intent,
 * never a database or HTTP call. One executor (Phase 2, service-role,
 * one transaction per event) applies effects and is the only impure
 * part. If you're importing a client here, the boundary is wrong.
 */

// --- events we handle (hand-modelled from Stripe's documented shapes;
// replace fixtures with `stripe listen` recordings once the account exists)

export interface CheckoutSessionCompleted {
  id: string;
  type: "checkout.session.completed";
  data: {
    sessionId: string;
    paymentIntentId: string;
    customerEmail: string;
    amountTotalCents: number; // gross + tax
    amountTaxCents: number;
    metadata: {
      productId: string;
      productVersionId: string;
      sourceLinkId: string | null;
    };
  };
}

export interface ChargeSucceeded {
  id: string;
  type: "charge.succeeded";
  data: {
    paymentIntentId: string;
    /** From the balance transaction — the ONLY source of processing fees. */
    processingFeeCents: number;
  };
}

export interface ChargeRefunded {
  id: string;
  type: "charge.refunded";
  data: { paymentIntentId: string };
}

export interface DisputeCreated {
  id: string;
  type: "charge.dispute.created";
  data: { disputeId: string; paymentIntentId: string; amountCents: number; reason: string; evidenceDueAt: string };
}

export interface DisputeClosed {
  id: string;
  type: "charge.dispute.closed";
  data: { disputeId: string; paymentIntentId: string; status: "won" | "lost" | "warning_closed" };
}

export interface TransferFailed {
  id: string;
  type: "transfer.failed";
  data: { transferId: string; failureMessage: string };
}

export interface AccountUpdated {
  id: string;
  type: "account.updated";
  data: {
    accountId: string;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    disabledReason: string | null;
  };
}

export type StripeWebhookEvent =
  | CheckoutSessionCompleted
  | ChargeSucceeded
  | ChargeRefunded
  | DisputeCreated
  | DisputeClosed
  | TransferFailed
  | AccountUpdated;

// --- effects
//
// Ruling A1: the union is split by TRANSACTIONALITY.
//  * TransactionalEffect — DB writes only; applied inside the event's
//    single transaction by the executor.
//  * PostCommitEffect — anything outbound (email, alerts). The executor
//    writes these to effect_outbox IN THE SAME TRANSACTION (migration
//    0004); a drain worker sends after commit. The executor never makes
//    an outbound call.

export type TransactionalEffect =
  | {
      kind: "InsertOrder";
      order: {
        /** Deterministic: uuidv5(paymentIntentId) — knowable before the row exists (ruling A2). */
        id: string;
        buyerEmail: string;
        productId: string;
        productVersionId: string;
        creatorId: string;
        grossCents: number;
        taxCents: number;
        stripePaymentIntentId: string;
        sourceLinkId: string | null;
        hasLinkAssets: boolean;
        linkAssetsOnly: boolean;
      };
    }
  | {
      kind: "FinalizeOrderFees";
      orderId: string;
      processingCents: number;
      netCents: number;
      creatorCents: number;
      platformCents: number;
      maturesAtDaysFromCreation: 14;
    }
  | { kind: "InsertLedgerEntries"; entries: LedgerEntryDraft[] } // one batch = one atomic write
  | { kind: "UpdateOrderState"; orderId: string; state: "refunded" | "disputed" }
  | { kind: "InsertDispute"; orderId: string; stripeDisputeId: string; amountCents: number; reason: string; evidenceDueAt: string }
  | { kind: "ResolveDispute"; stripeDisputeId: string; outcome: "won" | "lost" | "warning_closed" }
  | { kind: "RevokeDeliveryTokens"; orderId: string }
  | { kind: "IssueDeliveryTokens"; orderId: string }
  | { kind: "UpdatePayoutState"; payoutId: string; state: "failed"; failureReason: string }
  | { kind: "UpdateKycStatus"; creatorId: string; kycStatus: "pending" | "verified" | "restricted" };

export type PostCommitEffect =
  | { kind: "SendEmail"; template: "delivery" | "refund-confirmation"; to: string; orderId: string }
  | { kind: "AlertAdmin"; alert: "dispute-opened"; orderId: string; detail: string };

/** Out-of-order arrival: park the event and retry — never fail, never skip. */
export interface RequeueEffect {
  kind: "Requeue";
  reason: string;
}

export type Effect = TransactionalEffect | PostCommitEffect | RequeueEffect;

const POST_COMMIT_KINDS = new Set(["SendEmail", "AlertAdmin"]);
export function isPostCommit(e: Effect): e is PostCommitEffect {
  return POST_COMMIT_KINDS.has(e.kind);
}

// --- per-handler state slices (looked up by the executor, passed in pure)

export interface OrderFactsForEvents {
  id: string;
  creatorId: string;
  buyerEmail: string;
  grossCents: number;
  feesFinal: boolean;
  state: "paid" | "refunded" | "disputed" | "reversed";
  hasLinkAssets: boolean;
}

export interface ReferralFacts {
  /** Referrer inside their live 12-month window at the time of the sale, else null. */
  activeReferrerId: string | null;
}
