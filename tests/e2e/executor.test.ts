import { describe, expect, it } from "vitest";
import { applyEffect, applyEvent } from "../../lib/executor/apply";
import { drainOutbox, MockSender } from "../../lib/executor/drain";
import { MockStore } from "../../lib/executor/mock-store";
import { orderIdForPaymentIntent } from "../../lib/stripe/order-id";
import type { CheckoutSessionCompleted } from "../../lib/stripe/events/types";

const T0 = Date.parse("2026-08-01T00:00:00Z");

const event: CheckoutSessionCompleted = {
  id: "evt_x",
  type: "checkout.session.completed",
  data: {
    sessionId: "cs_x",
    paymentIntentId: "pi_x",
    customerEmail: "b@example.com",
    amountTotalCents: 3132,
    amountTaxCents: 232,
    metadata: { productId: "p-1", productVersionId: "pv-1", sourceLinkId: null },
  },
};
const state = {
  type: "checkout.session.completed" as const,
  state: {
    orderExists: false,
    product: { id: "p-1", currentVersionId: "pv-1", creatorId: "bob", hasLinkAssets: false, linkAssetsOnly: false },
    sourceLinkExists: false,
  },
};

describe("executor", () => {
  it("applies all effects of one event atomically — a mid-transaction failure rolls back everything", () => {
    const store = new MockStore(() => T0);
    // Pre-insert the deterministic order id so InsertOrder conflicts AFTER
    // the earlier effects in the same transaction would have applied.
    store.transact((tx) => {
      tx.insertOrder({
        id: orderIdForPaymentIntent("pi_x"),
        buyerEmail: "other@example.com",
        productId: "p-1", productVersionId: "pv-1", creatorId: "bob",
        grossCents: 2900, taxCents: 232, stripePaymentIntentId: "pi_other",
        sourceLinkId: null, hasLinkAssets: false, linkAssetsOnly: false,
      });
    });
    const before = store.outboxRows().length;
    // orderExists=false lies to the handler → InsertOrder will conflict.
    expect(() => applyEvent(store, event, state)).toThrow(/duplicate order id/);
    // Nothing partial: no outbox rows, no processed record → the event retries.
    expect(store.outboxRows().length).toBe(before);
    expect(store.processedEventIds().has("evt_x")).toBe(false);
  });

  it("post-commit effects are outbox rows, never sends — then the drain sends them", async () => {
    const store = new MockStore(() => T0);
    applyEvent(store, event, state);
    const rows = store.outboxRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ effectType: "SendEmail", state: "pending", attempts: 0 });

    const sender = new MockSender();
    await drainOutbox(store, sender, { nowMs: T0 });
    expect(sender.sent).toHaveLength(1);
    expect(store.outboxRows()[0]).toMatchObject({ state: "sent", attempts: 1 });
  });

  it("drain retries with backoff and abandons after max attempts, error retained", async () => {
    const store = new MockStore(() => T0, 3, 1000); // max 3 attempts
    applyEvent(store, event, state);
    const sender = new MockSender();
    sender.failWhen = () => true;

    let now = T0;
    for (let i = 0; i < 5; i++) {
      await drainOutbox(store, sender, { nowMs: now });
      now += 60_000; // beyond any backoff
    }
    const row = store.outboxRows()[0]!;
    expect(row.state).toBe("abandoned"); // terminal after 3 attempts
    expect(row.attempts).toBe(3);
    expect(row.lastError).toBe("mock send failure");
    // Terminal really is terminal: further drains never claim it.
    await drainOutbox(store, sender, { nowMs: now });
    expect(store.outboxRows()[0]!.attempts).toBe(3);
  });

  it("backoff: a failed row is not due again immediately", async () => {
    const store = new MockStore(() => T0, 5, 1000);
    applyEvent(store, event, state);
    const sender = new MockSender();
    sender.failWhen = () => true;
    await drainOutbox(store, sender, { nowMs: T0 });
    // Immediately after failure: not due.
    expect(store.claimDueOutbox(10, T0)).toHaveLength(0);
    // After the backoff window (2^0 × 1000ms): due again.
    expect(store.claimDueOutbox(10, T0 + 1001)).toHaveLength(1);
  });

  it("an unknown effect kind is a hard error, never a silent skip", () => {
    const store = new MockStore(() => T0);
    // A future effect kind reaching an old executor must explode, not vanish.
    const rogue = { kind: "TeleportFunds" } as never;
    expect(() => store.transact((tx) => applyEffect(tx, rogue))).toThrow(/unknown effect kind/);
    // And the failed transaction left nothing behind.
    expect(store.outboxRows()).toHaveLength(0);
  });

  it("replay after success is a duplicate — zero additional effects", () => {
    const store = new MockStore(() => T0);
    const first = applyEvent(store, event, state);
    expect(first.outcome).toBe("process");
    const replayState = { ...state, state: { ...state.state, orderExists: true } };
    const second = applyEvent(store, event, replayState);
    expect(second.outcome).toBe("duplicate");
    expect(store.outboxRows()).toHaveLength(1);
  });
});
