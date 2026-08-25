import { describe, expect, it } from "vitest";
import { matchSourceLink } from "../../lib/attribution/match";
import { drainOutbox, MockSender } from "../../lib/executor/drain";
import { MockStore } from "../../lib/executor/mock-store";
import { applyEvent } from "../../lib/executor/apply";
import { canTransition, runPayoutPreview } from "../../lib/money/payout-runner";
import type { PayoutCandidateEntry } from "../../lib/money/payout";
import { runPipeline } from "../../lib/safety/pipeline";
import { MockScanners } from "../../lib/safety/scanners";
import { orderIdForPaymentIntent } from "../../lib/stripe/order-id";
import type { HandlerState } from "../../lib/stripe/router";
import type {
  ChargeRefunded,
  ChargeSucceeded,
  CheckoutSessionCompleted,
  DisputeClosed,
  DisputeCreated,
  OrderFactsForEvents,
  StripeWebhookEvent,
} from "../../lib/stripe/events/types";

/**
 * THE END-TO-END OFFLINE SIMULATION: the complete money path against the
 * mock store — no Stripe, no Supabase. If this passes, the money engine
 * is proven before a single real dollar moves.
 */

const DAY_MS = 86_400_000;
const T0 = Date.parse("2026-08-01T00:00:00Z");

// --- world fixtures ----------------------------------------------------

const PRODUCT = { id: "p-1", currentVersionId: "pv-1", creatorId: "bob", hasLinkAssets: false, linkAssetsOnly: false };
const REFERRAL_EXPIRES_MS = T0 + 365 * DAY_MS; // bob referred by alice at signup

interface World {
  store: MockStore;
  clock: { ms: number };
  reviewState: "pending" | "cleared" | "rejected";
  referralExpiresMs: number;
}

function makeWorld(): World {
  const clock = { ms: T0 };
  return { store: new MockStore(() => clock.ms), clock, reviewState: "pending", referralExpiresMs: REFERRAL_EXPIRES_MS };
}

// --- event builders ----------------------------------------------------

function checkout(pi: string, n: number): CheckoutSessionCompleted {
  return {
    id: `evt_co_${pi}`,
    type: "checkout.session.completed",
    data: {
      sessionId: `cs_${n}`,
      paymentIntentId: pi,
      customerEmail: `buyer${n}@example.com`,
      amountTotalCents: 3132,
      amountTaxCents: 232, // 2900 gross
      metadata: { productId: "p-1", productVersionId: "pv-1", sourceLinkId: "l-1" },
    },
  };
}
function charge(pi: string): ChargeSucceeded {
  return { id: `evt_ch_${pi}`, type: "charge.succeeded", data: { paymentIntentId: pi, processingFeeCents: 114 } };
}
function refund(pi: string): ChargeRefunded {
  return { id: `evt_rf_${pi}`, type: "charge.refunded", data: { paymentIntentId: pi } };
}
function disputeOpen(pi: string): DisputeCreated {
  return {
    id: `evt_dp_${pi}`,
    type: "charge.dispute.created",
    data: { disputeId: `dp_${pi}`, paymentIntentId: pi, amountCents: 2900, reason: "fraudulent", evidenceDueAt: "2026-09-10T00:00:00Z" },
  };
}
function disputeWin(pi: string): DisputeClosed {
  return { id: `evt_dw_${pi}`, type: "charge.dispute.closed", data: { disputeId: `dp_${pi}`, paymentIntentId: pi, status: "won" } };
}

// --- the slice resolver: exactly the lookups Phase 2 runs in SQL -------
// (each is a single indexed read — see lib/stripe/slice-contracts.ts)

function orderFacts(world: World, pi: string): OrderFactsForEvents | null {
  const o = world.store.order(orderIdForPaymentIntent(pi));
  if (!o) return null;
  return {
    id: o.id,
    creatorId: o.creatorId,
    buyerEmail: o.buyerEmail,
    grossCents: o.grossCents,
    feesFinal: o.feesFinal,
    state: o.state as OrderFactsForEvents["state"],
    hasLinkAssets: o.hasLinkAssets,
  };
}

function saleEntriesOf(world: World, pi: string) {
  const id = orderIdForPaymentIntent(pi);
  return world.store
    .ledgerOf("bob")
    .concat(world.store.ledgerOf("alice"))
    .filter((e) => e.orderId === id && (e.type === "sale" || e.type === "referral"));
}

function slicesFor(world: World, event: StripeWebhookEvent): HandlerState {
  switch (event.type) {
    case "checkout.session.completed":
      return {
        type: event.type,
        state: {
          orderExists: world.store.order(orderIdForPaymentIntent(event.data.paymentIntentId)) !== undefined,
          product: PRODUCT,
          sourceLinkExists: event.data.metadata.sourceLinkId === "l-1",
        },
      };
    case "charge.succeeded":
      return {
        type: event.type,
        state: {
          order: orderFacts(world, event.data.paymentIntentId),
          referral: { activeReferrerId: world.clock.ms < world.referralExpiresMs ? "alice" : null },
        },
      };
    case "charge.refunded":
      return {
        type: event.type,
        state: { order: orderFacts(world, event.data.paymentIntentId), saleEntries: saleEntriesOf(world, event.data.paymentIntentId) },
      };
    case "charge.dispute.created":
      return {
        type: event.type,
        state: {
          order: orderFacts(world, event.data.paymentIntentId),
          saleEntries: saleEntriesOf(world, event.data.paymentIntentId),
          disputeExists: world.store.dispute(`dp_${event.data.paymentIntentId}`) !== undefined,
        },
      };
    case "charge.dispute.closed": {
      const id = orderIdForPaymentIntent(event.data.paymentIntentId);
      const entry = world.store.ledgerOf("bob").find((e) => e.orderId === id && e.type === "dispute") ?? null;
      return {
        type: event.type,
        state: {
          disputeExists: world.store.dispute(event.data.disputeId) !== undefined,
          disputeEntry: entry,
          alreadyResolved: (world.store.dispute(event.data.disputeId)?.outcome ?? null) !== null,
        },
      };
    }
    case "transfer.failed":
      return { type: event.type, state: { payoutId: "po-1", alreadyFailed: false } };
    case "account.updated":
      return { type: event.type, state: { creatorId: "bob", currentKycStatus: "none" } };
  }
}

function deliver(world: World, event: StripeWebhookEvent) {
  return applyEvent(world.store, event, slicesFor(world, event));
}

/** Deliver a batch with requeue-retry until quiescent (the pgboss loop, in miniature). */
function deliverAll(world: World, events: StripeWebhookEvent[]): void {
  let pending = [...events];
  for (let pass = 0; pass < 10 && pending.length > 0; pass++) {
    const still: StripeWebhookEvent[] = [];
    for (const e of pending) {
      const result = deliver(world, e);
      if (result.outcome === "requeue") still.push(e);
    }
    if (still.length === pending.length) throw new Error(`no progress: ${still.map((e) => e.id).join(",")}`);
    pending = still;
  }
  if (pending.length > 0) throw new Error("events never drained");
}

function payoutEntries(world: World, creatorId: string): PayoutCandidateEntry[] {
  return world.store.ledgerOf(creatorId).map((e, i) => {
    const order = e.orderId ? world.store.order(e.orderId) : undefined;
    return {
      id: i,
      type: e.type as PayoutCandidateEntry["type"],
      amountCents: e.amountCents,
      order: order
        ? {
            state: order.state,
            maturesAt: new Date(order.maturesAtMs ?? world.clock.ms + DAY_MS),
            reviewState: world.reviewState,
          }
        : null,
      payoutId: null,
    };
  });
}

const verified = { kycStatus: "verified" as const, payoutsPaused: false, reserve: { reserveBps: 0, reserveUntil: null } };

// =======================================================================

describe("the complete money path, offline", () => {
  it("lifecycle: signup → publish → sale → payout → refund → dispute → exact ledger", async () => {
    const world = makeWorld();

    // 2. Publish passes the safety pipeline.
    const safety = await runPipeline(
      {
        files: [{ key: "k/kit.pdf", declaredFormat: "pdf", sniffedFormat: "pdf", sizeBytes: 900_000, isArchive: false }],
        linkUrls: [],
        title: "30-Day Growth Kit",
        description: "planner and hooks",
        extractedText: "plan your month",
        coverKey: null,
      },
      new MockScanners()
    );
    expect(safety.verdict.decision).toBe("publish");

    // 3. Buyer clicks the tracked link — attribution recorded, never guessed.
    expect(matchSourceLink({ metadataLinkId: "l-1", cookieLinkId: null, linkExists: (id) => id === "l-1" })).toBe("l-1");

    // 4–5. Three orders: session completes (fees pending, tokens, email), then fees finalise.
    for (const pi of ["pi_1", "pi_2", "pi_3"]) {
      deliver(world, checkout(pi, Number(pi.slice(3))));
      deliver(world, charge(pi));
      expect(world.store.tokenState(orderIdForPaymentIntent(pi))).toBe("issued");
      expect(world.store.order(orderIdForPaymentIntent(pi))?.creatorCents).toBe(2089);
    }

    // 6. Outbox drains — three receipts sent, nothing sent inside a transaction.
    const sender = new MockSender();
    const drained = await drainOutbox(world.store, sender, { nowMs: world.clock.ms });
    expect(drained).toEqual({ sent: 3, failed: 0 });
    expect(sender.sent.filter((e) => e.kind === "SendEmail")).toHaveLength(3);

    // 7–8. Clock advances past maturation (+1 day for the referral); review clears.
    world.clock.ms = T0 + 16 * DAY_MS;
    world.reviewState = "cleared";

    // 9. The payout run assembles the preview.
    const preview = runPayoutPreview(
      [
        { creator: { creatorId: "bob", ...verified }, entries: payoutEntries(world, "bob") },
        { creator: { creatorId: "alice", ...verified }, entries: payoutEntries(world, "alice") },
      ],
      new Date(world.clock.ms)
    );
    expect(preview.payouts.find((p) => p.creatorId === "bob")?.netCents).toBe(3 * 2089);
    // Alice's 3 × 34¢ referral is real money but under the $10 minimum — held, not lost.
    expect(preview.skipped.find((s) => s.creatorId === "alice")?.reason).toBe("below_minimum_transfer");

    // 10. Admin confirms — the only legal path, mirroring the DB machine.
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "executing")).toBe(true);
    expect(canTransition("executing", "sent")).toBe(true);
    expect(canTransition("pending", "executing")).toBe(false);

    // 11. Order 2 refunds: paired reversal, tokens revoked.
    deliver(world, refund("pi_2"));
    expect(world.store.tokenState(orderIdForPaymentIntent("pi_2"))).toBe("revoked");
    expect(world.store.order(orderIdForPaymentIntent("pi_2"))?.state).toBe("refunded");

    // 12. Order 3 disputes (debit + $15 fee + referral reversal), then WINS (restoring adjustment).
    deliver(world, disputeOpen("pi_3"));
    deliver(world, disputeWin("pi_3"));
    expect(world.store.dispute("dp_pi_3")?.outcome).toBe("won");

    // 13. FINAL ASSERT — the ledger sums exactly, per creator.
    const bob = world.store.balanceOf("bob");
    const alice = world.store.balanceOf("alice");
    // bob: 3×2089 sale − 2089 refund − (2089+1500) dispute + (2089+1500) won = 4178
    expect(bob).toBe(3 * 2089 - 2089);
    // alice: 3×34 referral − 34 (refund reversal) − 34 (dispute reversal) = 34
    expect(alice).toBe(34);

    console.log(`FINAL LEDGER  bob: ${bob}¢ (${world.store.ledgerOf("bob").length} entries)  alice: ${alice}¢ (${world.store.ledgerOf("alice").length} entries)`);
  });

  it("variant: every webhook delivered 3× and out of order — identical final state", async () => {
    const canonical = makeWorld();
    const events = [
      checkout("pi_1", 1), charge("pi_1"),
      checkout("pi_2", 2), charge("pi_2"), refund("pi_2"),
      checkout("pi_3", 3), charge("pi_3"), disputeOpen("pi_3"), disputeWin("pi_3"),
    ];
    deliverAll(canonical, events);

    const chaotic = makeWorld();
    // Reversed order AND every event three times.
    const storm = [...events].reverse().flatMap((e) => [e, e, e]);
    deliverAll(chaotic, storm);

    expect(chaotic.store.fingerprint()).toEqual(canonical.store.fingerprint());
    // Outbox effects also happen exactly once each.
    expect(chaotic.store.outboxRows().length).toBe(canonical.store.outboxRows().length);
  });

  it("variant: referral expires mid-run — earnings stop at the boundary, nothing retroactive", () => {
    const world = makeWorld();
    world.referralExpiresMs = T0 + 5 * DAY_MS;

    deliverAll(world, [checkout("pi_1", 1), charge("pi_1")]); // inside the window
    world.clock.ms = T0 + 10 * DAY_MS; // window closed
    deliverAll(world, [checkout("pi_2", 2), charge("pi_2")]);

    const alice = world.store.ledgerOf("alice");
    expect(alice).toHaveLength(1); // order 1 only
    expect(world.store.balanceOf("alice")).toBe(34); // order-1 earnings untouched — nothing retroactive
    expect(world.store.balanceOf("bob")).toBe(2 * 2089);
  });

  it("variant: clawbacks exceed period earnings — negative balance carried, no transfer, no bank clawback", () => {
    const world = makeWorld();
    deliverAll(world, [checkout("pi_1", 1), charge("pi_1"), refund("pi_1"), checkout("pi_2", 2), charge("pi_2"), disputeOpen("pi_2")]);
    world.clock.ms = T0 + 16 * DAY_MS;
    world.reviewState = "cleared";

    // 2089 + 2089 sales − 2089 refund − 3589 dispute = −1500: negative.
    expect(world.store.balanceOf("bob")).toBe(-1500);
    const preview = runPayoutPreview(
      [{ creator: { creatorId: "bob", ...verified }, entries: payoutEntries(world, "bob") }],
      new Date(world.clock.ms)
    );
    expect(preview.payouts).toHaveLength(0); // no transfer — the balance carries forward
    expect(preview.skipped[0]).toMatchObject({ reason: "non_positive_balance" });
  });

  it("variant: unverified creator — payout skipped, funds accrue, nothing forfeited", () => {
    const world = makeWorld();
    deliverAll(world, [checkout("pi_1", 1), charge("pi_1")]);
    world.clock.ms = T0 + 16 * DAY_MS;
    world.reviewState = "cleared";

    const preview = runPayoutPreview(
      [{ creator: { creatorId: "bob", ...verified, kycStatus: "pending" }, entries: payoutEntries(world, "bob") }],
      new Date(world.clock.ms)
    );
    expect(preview.payouts).toHaveLength(0);
    expect(preview.skipped[0]).toMatchObject({ reason: "kyc_not_verified" });
    expect(world.store.balanceOf("bob")).toBe(2089); // still theirs, indefinitely
  });

  it("variant: product rejected after sales — orders refunded, ledger reversed to zero", () => {
    const world = makeWorld();
    deliverAll(world, [checkout("pi_1", 1), charge("pi_1"), checkout("pi_2", 2), charge("pi_2")]);
    expect(world.store.balanceOf("bob")).toBe(2 * 2089);

    // Admin rejects → review_state rejected, every outstanding order auto-refunds.
    world.reviewState = "rejected";
    deliverAll(world, [refund("pi_1"), refund("pi_2")]);

    expect(world.store.balanceOf("bob")).toBe(0);
    expect(world.store.balanceOf("alice")).toBe(0); // referrals reversed too
    expect(world.store.order(orderIdForPaymentIntent("pi_1"))?.state).toBe("refunded");
    expect(world.store.tokenState(orderIdForPaymentIntent("pi_2"))).toBe("revoked");

    // And nothing from a rejected product can ever pay out.
    world.clock.ms = T0 + 20 * DAY_MS;
    const preview = runPayoutPreview(
      [{ creator: { creatorId: "bob", ...verified }, entries: payoutEntries(world, "bob") }],
      new Date(world.clock.ms)
    );
    expect(preview.payouts).toHaveLength(0);
  });
});
