import type { Effect, StripeWebhookEvent } from "./events/types";
import { route, type HandlerState } from "./router";

/**
 * Idempotency, pure. The executor loads the set of already-processed
 * event ids relevant to this event (in practice: one indexed lookup on
 * processed_events) and passes it in. A replay produces ZERO effects.
 * The RecordProcessedEvent marker is appended so the executor writes the
 * processed_events row IN THE SAME TRANSACTION as the effects — that
 * pairing is the entire idempotency guarantee (migration 0003).
 *
 * A Requeue result is NOT recorded as processed — the event must retry.
 */

export type ProcessResult =
  | { outcome: "duplicate"; effects: [] }
  | { outcome: "requeue"; reason: string; effects: [] }
  | { outcome: "process"; effects: Effect[]; recordEventId: string };

export function processEvent(
  event: StripeWebhookEvent,
  handlerState: HandlerState,
  processedEventIds: ReadonlySet<string>
): ProcessResult {
  if (processedEventIds.has(event.id)) {
    return { outcome: "duplicate", effects: [] };
  }
  const effects = route(event, handlerState);
  const requeue = effects.find((e) => e.kind === "Requeue");
  if (requeue) {
    return { outcome: "requeue", reason: requeue.kind === "Requeue" ? requeue.reason : "", effects: [] };
  }
  return { outcome: "process", effects, recordEventId: event.id };
}
