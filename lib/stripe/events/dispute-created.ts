import { entriesForDispute, type LedgerEntryDraft } from "../../money/ledger";
import type { DisputeCreated, Effect, OrderFactsForEvents } from "./types";

export interface DisputeCreatedState {
  order: OrderFactsForEvents | null;
  saleEntries: LedgerEntryDraft[];
  disputeExists: boolean;
}

/**
 * Chargeback: debit the sale + $15 fee share, reverse any referral, flag
 * the order. Evidence auto-assembly reads delivery_events (executor side).
 */
export function handleDisputeCreated(event: DisputeCreated, state: DisputeCreatedState): Effect[] {
  if (state.order === null) {
    return [{ kind: "Requeue", reason: `no order for payment intent ${event.data.paymentIntentId}` }];
  }
  if (!state.order.feesFinal) {
    // Same as refunds: the debit mirrors the sale entries — park until
    // charge.succeeded has written them.
    return [{ kind: "Requeue", reason: `fees not final for ${state.order.id} — dispute waits for charge.succeeded` }];
  }
  if (state.disputeExists) return []; // replay — stripe_dispute_id is UNIQUE

  const effects: Effect[] = [
    {
      kind: "InsertDispute",
      orderId: state.order.id,
      stripeDisputeId: event.data.disputeId,
      amountCents: event.data.amountCents,
      reason: event.data.reason,
      evidenceDueAt: event.data.evidenceDueAt,
    },
    { kind: "UpdateOrderState", orderId: state.order.id, state: "disputed" },
  ];
  if (state.saleEntries.length > 0) {
    effects.push({ kind: "InsertLedgerEntries", entries: entriesForDispute(state.saleEntries) });
  }
  effects.push({
    kind: "AlertAdmin",
    alert: "dispute-opened",
    orderId: state.order.id,
    detail: `${event.data.reason} — evidence due ${event.data.evidenceDueAt}`,
  });
  return effects;
}
