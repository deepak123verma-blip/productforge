import { processEvent, type ProcessResult } from "../stripe/idempotency";
import type { HandlerState } from "../stripe/router";
import type { Effect, StripeWebhookEvent } from "../stripe/events/types";
import { isPostCommit } from "../stripe/events/types";
import type { Store, StoreTx } from "./store";

/**
 * The executor: the ONLY impure part of the webhook path — and its
 * impurity is confined to the Store interface. One event → one
 * transaction containing every transactional effect, every outbox row,
 * and the processed_events record. Unknown effect kinds are a hard
 * error, never a silent skip.
 */

export function applyEffect(tx: StoreTx, effect: Effect): void {
  if (isPostCommit(effect)) {
    tx.enqueueOutbox(effect); // written in-tx, SENT after commit by the drain
    return;
  }
  switch (effect.kind) {
    case "InsertOrder":
      tx.insertOrder(effect.order);
      return;
    case "FinalizeOrderFees":
      tx.finalizeOrderFees(effect.orderId, {
        processingCents: effect.processingCents,
        netCents: effect.netCents,
        creatorCents: effect.creatorCents,
        platformCents: effect.platformCents,
        maturesAtDaysFromCreation: effect.maturesAtDaysFromCreation,
      });
      return;
    case "InsertLedgerEntries":
      tx.insertLedgerEntries(effect.entries);
      return;
    case "UpdateOrderState":
      tx.updateOrderState(effect.orderId, effect.state);
      return;
    case "InsertDispute":
      tx.insertDispute({
        orderId: effect.orderId,
        stripeDisputeId: effect.stripeDisputeId,
        amountCents: effect.amountCents,
        reason: effect.reason,
        evidenceDueAt: effect.evidenceDueAt,
      });
      return;
    case "ResolveDispute":
      tx.resolveDispute(effect.stripeDisputeId, effect.outcome);
      return;
    case "IssueDeliveryTokens":
      tx.issueDeliveryTokens(effect.orderId);
      return;
    case "RevokeDeliveryTokens":
      tx.revokeDeliveryTokens(effect.orderId);
      return;
    case "UpdatePayoutState":
      tx.updatePayoutState(effect.payoutId, effect.state, effect.failureReason);
      return;
    case "UpdateKycStatus":
      tx.updateKycStatus(effect.creatorId, effect.kycStatus);
      return;
    case "Requeue":
      // processEvent never lets a Requeue reach the executor.
      throw new Error("Requeue effect reached the executor — processEvent must intercept it");
    default: {
      const never: never = effect;
      throw new Error(`unknown effect kind: ${JSON.stringify(never)} — refusing to silently skip`);
    }
  }
}

export function applyEvent(store: Store, event: StripeWebhookEvent, handlerState: HandlerState): ProcessResult {
  const result = processEvent(event, handlerState, store.processedEventIds());
  if (result.outcome !== "process") return result;
  store.transact((tx) => {
    for (const effect of result.effects) applyEffect(tx, effect);
    tx.recordProcessedEvent(result.recordEventId);
  });
  return result;
}
