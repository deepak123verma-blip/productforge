import type { LedgerEntryDraft } from "../money/ledger";
import type { PostCommitEffect } from "../stripe/events/types";
import type { InsertOrderData, OutboxRow, Store, StoreTx } from "./store";

/**
 * In-memory Store for tests and the offline build. Mirrors the DB's
 * discipline where it matters:
 *  - the ledger is append-only (there is no update method to call);
 *  - order ids are unique (replay of a deterministic id conflicts);
 *  - the outbox follows migration 0004's state machine.
 * transact() snapshots state and rolls back on throw — atomicity for real.
 */

const DAY_MS = 86_400_000;

export interface MockOrder extends InsertOrderData {
  state: "paid" | "refunded" | "disputed";
  feesFinal: boolean;
  processingCents: number;
  netCents: number;
  creatorCents: number;
  platformCents: number;
  createdAtMs: number;
  maturesAtMs: number | null;
}

interface MockDispute {
  orderId: string;
  amountCents: number;
  reason: string;
  evidenceDueAt: string;
  outcome: "won" | "lost" | "warning_closed" | null;
}

interface State {
  orders: Map<string, MockOrder>;
  ledger: (LedgerEntryDraft & { seq: number })[];
  disputes: Map<string, MockDispute>;
  payouts: Map<string, { state: string; failureReason: string | null }>;
  kyc: Map<string, string>;
  tokens: Map<string, "issued" | "revoked">;
  outbox: OutboxRow[];
  processed: Set<string>;
  seq: number;
  outboxSeq: number;
}

export class MockStore implements Store {
  private state: State = {
    orders: new Map(),
    ledger: [],
    disputes: new Map(),
    payouts: new Map(),
    kyc: new Map(),
    tokens: new Map(),
    outbox: [],
    processed: new Set(),
    seq: 0,
    outboxSeq: 0,
  };

  constructor(
    public nowMs: () => number,
    private readonly maxOutboxAttempts = 5,
    private readonly backoffBaseMs = 1000
  ) {}

  transact<T>(fn: (tx: StoreTx) => T): T {
    const snapshot = structuredClone(this.state);
    try {
      return fn(this.makeTx());
    } catch (e) {
      this.state = snapshot; // atomic: all or nothing
      throw e;
    }
  }

  private makeTx(): StoreTx {
    const s = this.state;
    const now = this.nowMs;
    return {
      insertOrder(order) {
        if (s.orders.has(order.id)) {
          throw new Error(`duplicate order id ${order.id} — deterministic replay conflict`);
        }
        s.orders.set(order.id, {
          ...order,
          state: "paid",
          feesFinal: false,
          processingCents: 0,
          netCents: 0,
          creatorCents: 0,
          platformCents: 0,
          createdAtMs: now(),
          maturesAtMs: null,
        });
      },
      finalizeOrderFees(orderId, fees) {
        const o = s.orders.get(orderId);
        if (!o) throw new Error(`no order ${orderId}`);
        o.processingCents = fees.processingCents;
        o.netCents = fees.netCents;
        o.creatorCents = fees.creatorCents;
        o.platformCents = fees.platformCents;
        o.feesFinal = true;
        o.maturesAtMs = o.createdAtMs + fees.maturesAtDaysFromCreation * DAY_MS;
      },
      insertLedgerEntries(entries) {
        for (const e of entries) s.ledger.push({ ...e, seq: ++s.seq }); // append-only; no update path exists
      },
      updateOrderState(orderId, state) {
        const o = s.orders.get(orderId);
        if (!o) throw new Error(`no order ${orderId}`);
        o.state = state;
      },
      insertDispute(d) {
        if (s.disputes.has(d.stripeDisputeId)) throw new Error(`duplicate dispute ${d.stripeDisputeId}`);
        s.disputes.set(d.stripeDisputeId, { orderId: d.orderId, amountCents: d.amountCents, reason: d.reason, evidenceDueAt: d.evidenceDueAt, outcome: null });
      },
      resolveDispute(id, outcome) {
        const d = s.disputes.get(id);
        if (!d) throw new Error(`no dispute ${id}`);
        d.outcome = outcome;
      },
      issueDeliveryTokens(orderId) {
        s.tokens.set(orderId, "issued");
      },
      revokeDeliveryTokens(orderId) {
        s.tokens.set(orderId, "revoked");
      },
      updatePayoutState(payoutId, state, failureReason) {
        s.payouts.set(payoutId, { state, failureReason });
      },
      updateKycStatus(creatorId, kycStatus) {
        s.kyc.set(creatorId, kycStatus);
      },
      enqueueOutbox(effect: PostCommitEffect) {
        s.outbox.push({
          id: ++s.outboxSeq,
          effectType: effect.kind,
          payload: effect,
          state: "pending",
          attempts: 0,
          lastError: null,
          nextAttemptAtMs: now(),
          createdAtMs: now(),
          processedAtMs: null,
        });
      },
      recordProcessedEvent(eventId) {
        if (s.processed.has(eventId)) throw new Error(`event ${eventId} already recorded — idempotency race`);
        s.processed.add(eventId);
      },
    };
  }

  processedEventIds(): ReadonlySet<string> {
    return this.state.processed;
  }

  claimDueOutbox(limit: number, nowMs: number): OutboxRow[] {
    const due = this.state.outbox
      .filter((r) => (r.state === "pending" || r.state === "failed") && r.nextAttemptAtMs <= nowMs)
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .slice(0, limit);
    for (const r of due) r.attempts += 1; // a claim IS an attempt (smoke test 35)
    return due;
  }

  markOutboxSent(id: number, nowMs: number): void {
    const r = this.row(id);
    if (r.state === "sent" || r.state === "abandoned") throw new Error(`outbox ${id} is terminal (${r.state})`);
    if (r.attempts < 1) throw new Error(`outbox ${id} cannot be sent with zero attempts`);
    r.state = "sent";
    r.processedAtMs = nowMs;
  }

  markOutboxFailed(id: number, error: string, nowMs: number): void {
    const r = this.row(id);
    if (r.state === "sent" || r.state === "abandoned") throw new Error(`outbox ${id} is terminal (${r.state})`);
    r.lastError = error;
    if (r.attempts >= this.maxOutboxAttempts) {
      r.state = "abandoned"; // terminal, error retained
      r.processedAtMs = nowMs;
    } else {
      r.state = "failed";
      r.nextAttemptAtMs = nowMs + this.backoffBaseMs * 2 ** (r.attempts - 1); // exponential backoff
    }
  }

  private row(id: number): OutboxRow {
    const r = this.state.outbox.find((x) => x.id === id);
    if (!r) throw new Error(`no outbox row ${id}`);
    return r;
  }

  // --- inspection helpers for tests -----------------------------------

  balanceOf(creatorId: string): number {
    let sum = 0;
    for (const e of this.state.ledger) if (e.creatorId === creatorId) sum += e.amountCents;
    return sum;
  }
  ledgerOf(creatorId: string): LedgerEntryDraft[] {
    return this.state.ledger.filter((e) => e.creatorId === creatorId);
  }
  order(id: string): MockOrder | undefined {
    return this.state.orders.get(id);
  }
  tokenState(orderId: string): "issued" | "revoked" | undefined {
    return this.state.tokens.get(orderId);
  }
  dispute(id: string): MockDispute | undefined {
    return this.state.disputes.get(id);
  }
  kycOf(creatorId: string): string | undefined {
    return this.state.kyc.get(creatorId);
  }
  outboxRows(): readonly OutboxRow[] {
    return this.state.outbox;
  }
  /** Deep-comparable view of everything money-relevant, for A/B run equivalence.
      Ledger order is arrival order and legitimately differs between runs —
      sort canonically; the SET of entries is what must match. */
  fingerprint(): unknown {
    const key = (e: { orderId: string | null; type: string; creatorId: string; amountCents: number }) =>
      `${e.orderId}|${e.type}|${e.creatorId}|${e.amountCents}`;
    return {
      orders: [...this.state.orders.entries()].sort(),
      ledger: this.state.ledger
        .map((entry) => {
          const { seq, ...rest } = entry;
          void seq; // arrival order is excluded from the fingerprint on purpose
          return rest;
        })
        .sort((a, b) => key(a).localeCompare(key(b))),
      disputes: [...this.state.disputes.entries()].sort(),
      tokens: [...this.state.tokens.entries()].sort(),
    };
  }
}
