import { computeSplit } from "../../money/split";
import { entriesForSale } from "../../money/ledger";
import type { ChargeSucceeded, Effect, OrderFactsForEvents, ReferralFacts } from "./types";

export interface ChargeSucceededState {
  order: OrderFactsForEvents | null;
  referral: ReferralFacts;
}

/**
 * Fees are now final: compute the split from the balance transaction and
 * write the sale + paired referral ATOMICALLY (one InsertLedgerEntries
 * batch = one transaction in the executor). The order becomes payable
 * only after this.
 */
export function handleChargeSucceeded(event: ChargeSucceeded, state: ChargeSucceededState): Effect[] {
  if (state.order === null) {
    // checkout.session.completed hasn't landed yet — Stripe delivers out
    // of order routinely. Queue and retry, never fail.
    return [{ kind: "Requeue", reason: `no order for payment intent ${event.data.paymentIntentId}` }];
  }
  if (state.order.feesFinal) return []; // replay — split already written

  const { net, creator, platform } = computeSplit(state.order.grossCents, event.data.processingFeeCents);
  const entries = entriesForSale({
    sellerCreatorId: state.order.creatorId,
    orderId: state.order.id,
    creatorCents: creator,
    platformCents: platform,
    activeReferrerId: state.referral.activeReferrerId,
  });
  return [
    {
      kind: "FinalizeOrderFees",
      orderId: state.order.id,
      processingCents: event.data.processingFeeCents,
      netCents: net,
      creatorCents: creator,
      platformCents: platform,
      maturesAtDaysFromCreation: 14,
    },
    { kind: "InsertLedgerEntries", entries },
  ];
}
