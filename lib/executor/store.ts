import type { LedgerEntryDraft } from "../money/ledger";
import type { PostCommitEffect, TransactionalEffect } from "../stripe/events/types";

/**
 * The store interface the executor writes through — same trick as the
 * repositories: mock-store.ts satisfies it now, a Supabase-backed
 * implementation later. THE EXECUTOR NEVER IMPORTS A DB CLIENT.
 *
 * transact(): everything inside applies atomically or none of it does.
 * The outbox insert and the processed_events record ride the same
 * transaction as the event's DB writes — that pairing IS the
 * idempotency and at-least-once-delivery guarantee.
 */

export type InsertOrderData = Extract<TransactionalEffect, { kind: "InsertOrder" }>["order"];

export interface StoreTx {
  insertOrder(order: InsertOrderData): void;
  finalizeOrderFees(orderId: string, fees: { processingCents: number; netCents: number; creatorCents: number; platformCents: number; maturesAtDaysFromCreation: number }): void;
  /** ONE batch = one atomic write — the sale/referral pairing stays structural. */
  insertLedgerEntries(entries: LedgerEntryDraft[]): void;
  updateOrderState(orderId: string, state: "refunded" | "disputed"): void;
  insertDispute(d: { orderId: string; stripeDisputeId: string; amountCents: number; reason: string; evidenceDueAt: string }): void;
  resolveDispute(stripeDisputeId: string, outcome: "won" | "lost" | "warning_closed"): void;
  issueDeliveryTokens(orderId: string): void;
  revokeDeliveryTokens(orderId: string): void;
  updatePayoutState(payoutId: string, state: "failed", failureReason: string): void;
  updateKycStatus(creatorId: string, kycStatus: "pending" | "verified" | "restricted"): void;
  enqueueOutbox(effect: PostCommitEffect): void;
  recordProcessedEvent(eventId: string): void;
}

export interface OutboxRow {
  id: number;
  effectType: PostCommitEffect["kind"];
  payload: PostCommitEffect;
  state: "pending" | "sent" | "failed" | "abandoned";
  attempts: number;
  lastError: string | null;
  nextAttemptAtMs: number;
  createdAtMs: number;
  processedAtMs: number | null;
}

export interface Store {
  transact<T>(fn: (tx: StoreTx) => T): T;
  processedEventIds(): ReadonlySet<string>;

  /** Drain query: due pending/failed rows, oldest first. Claiming increments attempts — a claim IS an attempt. */
  claimDueOutbox(limit: number, nowMs: number): OutboxRow[];
  markOutboxSent(id: number, nowMs: number): void;
  /** Backoff on failure; abandon (terminal, error retained) past maxAttempts. */
  markOutboxFailed(id: number, error: string, nowMs: number): void;
}
