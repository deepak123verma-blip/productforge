import { entriesForRefund, type LedgerEntryDraft } from "../../money/ledger";
import type { ChargeRefunded, Effect, OrderFactsForEvents } from "./types";

export interface ChargeRefundedState {
  order: OrderFactsForEvents | null;
  /** The order's original sale (+ referral) ledger entries. Empty if fees never finalised. */
  saleEntries: LedgerEntryDraft[];
}

/**
 * Refund: reverse the sale AND its paired referral in one atomic batch,
 * flip the order, revoke download tokens. If the creator was already
 * paid, the executor's balance simply goes negative and carries forward.
 */
export function handleChargeRefunded(event: ChargeRefunded, state: ChargeRefundedState): Effect[] {
  if (state.order === null) {
    return [{ kind: "Requeue", reason: `no order for payment intent ${event.data.paymentIntentId}` }];
  }
  if (!state.order.feesFinal) {
    // The reversal mirrors the sale entries, which exist only after
    // charge.succeeded. Refunding before that would flip the order with
    // no ledger reversal, then the late sale would credit anyway —
    // caught by the e2e out-of-order storm. Park until fees are final.
    return [{ kind: "Requeue", reason: `fees not final for ${state.order.id} — refund waits for charge.succeeded` }];
  }
  if (state.order.state === "refunded") return []; // replay

  const effects: Effect[] = [{ kind: "UpdateOrderState", orderId: state.order.id, state: "refunded" }];
  if (state.saleEntries.length > 0) {
    effects.push({ kind: "InsertLedgerEntries", entries: entriesForRefund(state.saleEntries) });
  }
  effects.push(
    { kind: "RevokeDeliveryTokens", orderId: state.order.id },
    { kind: "SendEmail", template: "refund-confirmation", to: state.order.buyerEmail, orderId: state.order.id }
  );
  return effects;
}
