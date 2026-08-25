import type { PostCommitEffect } from "../stripe/events/types";
import type { Store } from "./store";

/**
 * The outbox drain: the only place outbound calls happen. At-least-once
 * by design (a crash between send and markOutboxSent redelivers), so
 * senders must tolerate duplicates. Backoff and abandonment live in the
 * store (mirroring migration 0004's state machine).
 */

export interface Sender {
  send(effect: PostCommitEffect): Promise<void>;
}

/** Mock sender: records what it was asked to send; optionally fails by predicate. */
export class MockSender implements Sender {
  sent: PostCommitEffect[] = [];
  failWhen: (e: PostCommitEffect) => boolean = () => false;
  async send(effect: PostCommitEffect): Promise<void> {
    if (this.failWhen(effect)) throw new Error("mock send failure");
    this.sent.push(effect);
  }
}

export interface DrainResult {
  sent: number;
  failed: number;
}

export async function drainOutbox(
  store: Store,
  sender: Sender,
  opts: { nowMs: number; limit?: number }
): Promise<DrainResult> {
  const rows = store.claimDueOutbox(opts.limit ?? 50, opts.nowMs);
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await sender.send(row.payload);
      store.markOutboxSent(row.id, opts.nowMs);
      sent += 1;
    } catch (e) {
      store.markOutboxFailed(row.id, e instanceof Error ? e.message : String(e), opts.nowMs);
      failed += 1;
    }
  }
  return { sent, failed };
}
