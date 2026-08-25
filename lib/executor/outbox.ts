import type { PostCommitEffect } from "../stripe/events/types";

/**
 * Post-commit effects → outbox rows (migration 0004). The executor
 * writes rows through StoreTx.enqueueOutbox inside the event's
 * transaction; this module owns the (de)serialization contract so the
 * Supabase-backed store and the drain worker agree on the payload shape.
 */

export interface OutboxInsert {
  effect_type: PostCommitEffect["kind"];
  payload: PostCommitEffect;
}

export function toOutboxInsert(effect: PostCommitEffect): OutboxInsert {
  return { effect_type: effect.kind, payload: effect };
}

export function fromOutboxPayload(payload: unknown): PostCommitEffect {
  const p = payload as PostCommitEffect;
  if (p?.kind !== "SendEmail" && p?.kind !== "AlertAdmin") {
    throw new Error(`outbox payload with unknown kind: ${JSON.stringify(payload)} — refusing to silently skip`);
  }
  return p;
}
