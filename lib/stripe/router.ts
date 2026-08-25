import { handleAccountUpdated, type AccountUpdatedState } from "./events/account-updated";
import { handleChargeRefunded, type ChargeRefundedState } from "./events/charge-refunded";
import { handleChargeSucceeded, type ChargeSucceededState } from "./events/charge-succeeded";
import { handleCheckoutCompleted, type CheckoutCompletedState } from "./events/checkout-completed";
import { handleDisputeClosed, type DisputeClosedState } from "./events/dispute-closed";
import { handleDisputeCreated, type DisputeCreatedState } from "./events/dispute-created";
import { handleTransferFailed, type TransferFailedState } from "./events/transfer-failed";
import type { Effect, StripeWebhookEvent } from "./events/types";

/**
 * Event type → pure handler. The executor (Phase 2) looks up the state
 * slice, calls route(), and applies the effects in one transaction
 * together with the processed_events insert.
 */

export type HandlerState =
  | { type: "checkout.session.completed"; state: CheckoutCompletedState }
  | { type: "charge.succeeded"; state: ChargeSucceededState }
  | { type: "charge.refunded"; state: ChargeRefundedState }
  | { type: "charge.dispute.created"; state: DisputeCreatedState }
  | { type: "charge.dispute.closed"; state: DisputeClosedState }
  | { type: "transfer.failed"; state: TransferFailedState }
  | { type: "account.updated"; state: AccountUpdatedState };

export function route(event: StripeWebhookEvent, handlerState: HandlerState): Effect[] {
  if (event.type !== handlerState.type) {
    throw new TypeError(`state slice for ${handlerState.type} passed to a ${event.type} event`);
  }
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event, handlerState.state as CheckoutCompletedState);
    case "charge.succeeded":
      return handleChargeSucceeded(event, handlerState.state as ChargeSucceededState);
    case "charge.refunded":
      return handleChargeRefunded(event, handlerState.state as ChargeRefundedState);
    case "charge.dispute.created":
      return handleDisputeCreated(event, handlerState.state as DisputeCreatedState);
    case "charge.dispute.closed":
      return handleDisputeClosed(event, handlerState.state as DisputeClosedState);
    case "transfer.failed":
      return handleTransferFailed(event, handlerState.state as TransferFailedState);
    case "account.updated":
      return handleAccountUpdated(event, handlerState.state as AccountUpdatedState);
  }
}
