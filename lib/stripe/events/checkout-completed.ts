import { orderIdForPaymentIntent } from "../order-id";
import type { CheckoutSessionCompleted, Effect } from "./types";

export interface CheckoutCompletedState {
  /** True when this payment intent already has an order (replay / race). */
  orderExists: boolean;
  product: {
    id: string;
    currentVersionId: string;
    creatorId: string;
    hasLinkAssets: boolean;
    linkAssetsOnly: boolean;
  } | null;
  /** Does metadata.sourceLinkId reference a real link? Never guess attribution. */
  sourceLinkExists: boolean;
}

/**
 * Order creation intent. Fees are NOT known yet (they arrive with
 * charge.succeeded) — delivery never waits on accounting.
 */
export function handleCheckoutCompleted(
  event: CheckoutSessionCompleted,
  state: CheckoutCompletedState
): Effect[] {
  if (state.orderExists) return []; // replay of the same session — no-op beyond idempotency record
  if (state.product === null) {
    return [{ kind: "Requeue", reason: `product ${event.data.metadata.productId} not found yet` }];
  }
  const grossCents = event.data.amountTotalCents - event.data.amountTaxCents;
  // Deterministic (ruling A2): knowable before the row exists, replay-safe.
  const orderId = orderIdForPaymentIntent(event.data.paymentIntentId);
  return [
    {
      kind: "InsertOrder",
      order: {
        id: orderId,
        buyerEmail: event.data.customerEmail,
        productId: state.product.id,
        productVersionId: event.data.metadata.productVersionId,
        creatorId: state.product.creatorId,
        grossCents,
        taxCents: event.data.amountTaxCents,
        stripePaymentIntentId: event.data.paymentIntentId,
        sourceLinkId: state.sourceLinkExists ? event.data.metadata.sourceLinkId : null,
        hasLinkAssets: state.product.hasLinkAssets,
        linkAssetsOnly: state.product.linkAssetsOnly,
      },
    },
    { kind: "IssueDeliveryTokens", orderId },
    { kind: "SendEmail", template: "delivery", to: event.data.customerEmail, orderId },
  ];
}
