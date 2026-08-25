import { describe, expect, it } from "vitest";
import { entriesForSale } from "../../lib/money/ledger";
import { processEvent } from "../../lib/stripe/idempotency";
import { route, type HandlerState } from "../../lib/stripe/router";
import * as fx from "./fixtures";

const SALE = entriesForSale({
  sellerCreatorId: "seller",
  orderId: "order-1",
  creatorCents: 2089,
  platformCents: 697,
  activeReferrerId: "referrer",
});
const SALE_NO_REFERRAL = entriesForSale({
  sellerCreatorId: "seller",
  orderId: "order-1",
  creatorCents: 2089,
  platformCents: 697,
  activeReferrerId: null,
});

describe("checkout.session.completed", () => {
  const state: HandlerState = {
    type: "checkout.session.completed",
    state: {
      orderExists: false,
      product: { id: "p-1", currentVersionId: "pv-1", creatorId: "seller", hasLinkAssets: true, linkAssetsOnly: false },
      sourceLinkExists: true,
    },
  };

  it("creates the order with fees pending, issues tokens, sends delivery email", () => {
    const effects = route(fx.checkoutCompleted, state);
    expect(effects.map((e) => e.kind)).toEqual(["InsertOrder", "IssueDeliveryTokens", "SendEmail"]);
    const order = effects[0]!.kind === "InsertOrder" ? effects[0]!.order : null;
    expect(order).toMatchObject({ grossCents: 2900, taxCents: 232, sourceLinkId: "l-1" });
  });

  it("a dead source link yields null attribution — Direct, never guessed", () => {
    const effects = route(fx.checkoutCompleted, {
      ...state,
      state: { ...state.state, sourceLinkExists: false },
    } as HandlerState);
    expect(effects[0]).toMatchObject({ kind: "InsertOrder", order: { sourceLinkId: null } });
  });

  it("an existing order makes the replay a no-op", () => {
    expect(route(fx.checkoutCompleted, { ...state, state: { ...state.state, orderExists: true } } as HandlerState)).toEqual([]);
  });
});

describe("charge.succeeded", () => {
  it("finalises fees with the binding split and writes sale + paired referral atomically", () => {
    const effects = route(fx.chargeSucceeded, {
      type: "charge.succeeded",
      state: { order: fx.paidOrder, referral: { activeReferrerId: "referrer" } },
    });
    expect(effects).toHaveLength(2);
    expect(effects[0]).toMatchObject({
      kind: "FinalizeOrderFees",
      processingCents: 114,
      netCents: 2786,
      creatorCents: 2089,
      platformCents: 697,
    });
    const batch = effects[1]!.kind === "InsertLedgerEntries" ? effects[1]!.entries : [];
    expect(batch.map((e) => e.type)).toEqual(["sale", "referral"]);
    expect(batch[1]!.amountCents).toBe(34);
  });

  it("arriving BEFORE checkout.session.completed queues rather than failing", () => {
    const effects = route(fx.chargeSucceeded, {
      type: "charge.succeeded",
      state: { order: null, referral: { activeReferrerId: null } },
    });
    expect(effects).toEqual([{ kind: "Requeue", reason: expect.stringContaining("pi_001") }]);
  });

  it("already-final fees make the replay a no-op", () => {
    const effects = route(fx.chargeSucceeded, {
      type: "charge.succeeded",
      state: { order: { ...fx.paidOrder, feesFinal: true }, referral: { activeReferrerId: null } },
    });
    expect(effects).toEqual([]);
  });
});

describe("charge.refunded and charge.dispute.created — paired reversals", () => {
  it("refund reverses sale AND referral when a referral exists", () => {
    const effects = route(fx.chargeRefunded, {
      type: "charge.refunded",
      state: { order: { ...fx.paidOrder, feesFinal: true }, saleEntries: SALE },
    });
    const batch = effects.find((e) => e.kind === "InsertLedgerEntries");
    expect(batch && batch.kind === "InsertLedgerEntries" ? batch.entries.map((e) => e.type) : []).toEqual([
      "refund",
      "referral_reversal",
    ]);
    expect(effects.some((e) => e.kind === "RevokeDeliveryTokens")).toBe(true);
    expect(effects.some((e) => e.kind === "UpdateOrderState")).toBe(true);
  });

  it("refund never emits a referral reversal when no referral exists", () => {
    const effects = route(fx.chargeRefunded, {
      type: "charge.refunded",
      state: { order: { ...fx.paidOrder, feesFinal: true }, saleEntries: SALE_NO_REFERRAL },
    });
    const batch = effects.find((e) => e.kind === "InsertLedgerEntries");
    expect(batch && batch.kind === "InsertLedgerEntries" ? batch.entries.map((e) => e.type) : []).toEqual(["refund"]);
  });

  it("dispute debits the sale + $15 fee and reverses the referral", () => {
    const effects = route(fx.disputeCreated, {
      type: "charge.dispute.created",
      state: { order: { ...fx.paidOrder, feesFinal: true }, saleEntries: SALE, disputeExists: false },
    });
    const batch = effects.find((e) => e.kind === "InsertLedgerEntries");
    const entries = batch && batch.kind === "InsertLedgerEntries" ? batch.entries : [];
    expect(entries.map((e) => e.type)).toEqual(["dispute", "referral_reversal"]);
    expect(entries[0]!.amountCents).toBe(-(2089 + 1500));
    expect(entries[1]!.amountCents).toBe(-34);
  });
});

describe("charge.dispute.closed", () => {
  const disputeEntry = {
    creatorId: "seller",
    orderId: "order-1",
    type: "dispute" as const,
    amountCents: -(2089 + 1500),
    referralOfCreatorId: null,
    memo: null,
  };

  it("won emits a restoring adjustment exactly equal to the original debit", () => {
    const effects = route(fx.disputeWon, {
      type: "charge.dispute.closed",
      state: { disputeExists: true, disputeEntry, alreadyResolved: false },
    });
    const batch = effects.find((e) => e.kind === "InsertLedgerEntries");
    const entries = batch && batch.kind === "InsertLedgerEntries" ? batch.entries : [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: "adjustment", amountCents: 2089 + 1500 });
  });

  it("lost emits no ledger entry — the debit stands", () => {
    const effects = route(fx.disputeLost, {
      type: "charge.dispute.closed",
      state: { disputeExists: true, disputeEntry, alreadyResolved: false },
    });
    expect(effects.some((e) => e.kind === "InsertLedgerEntries")).toBe(false);
    expect(effects[0]).toMatchObject({ kind: "ResolveDispute", outcome: "lost" });
  });
});

describe("transfer.failed and account.updated", () => {
  it("transfer failure flips the payout to failed with the reason", () => {
    const effects = route(fx.transferFailed, {
      type: "transfer.failed",
      state: { payoutId: "po-1", alreadyFailed: false },
    });
    expect(effects[0]).toMatchObject({ kind: "UpdatePayoutState", state: "failed" });
  });

  it("account verification transitions kyc_status; no change is a no-op", () => {
    expect(
      route(fx.accountUpdated, { type: "account.updated", state: { creatorId: "seller", currentKycStatus: "pending" } })[0]
    ).toMatchObject({ kind: "UpdateKycStatus", kycStatus: "verified" });
    expect(
      route(fx.accountUpdated, { type: "account.updated", state: { creatorId: "seller", currentKycStatus: "verified" } })
    ).toEqual([]);
  });
});

describe("idempotency — every event replayed 3× produces effects once", () => {
  const cases: { event: Parameters<typeof processEvent>[0]; state: HandlerState }[] = [
    {
      event: fx.checkoutCompleted,
      state: {
        type: "checkout.session.completed",
        state: {
          orderExists: false,
          product: { id: "p-1", currentVersionId: "pv-1", creatorId: "seller", hasLinkAssets: false, linkAssetsOnly: false },
          sourceLinkExists: true,
        },
      },
    },
    { event: fx.chargeSucceeded, state: { type: "charge.succeeded", state: { order: fx.paidOrder, referral: { activeReferrerId: "referrer" } } } },
    { event: fx.chargeRefunded, state: { type: "charge.refunded", state: { order: { ...fx.paidOrder, feesFinal: true }, saleEntries: SALE } } },
    { event: fx.disputeCreated, state: { type: "charge.dispute.created", state: { order: { ...fx.paidOrder, feesFinal: true }, saleEntries: SALE, disputeExists: false } } },
    { event: fx.disputeWon, state: { type: "charge.dispute.closed", state: { disputeExists: true, disputeEntry: SALE[0] ? { ...SALE[0], type: "dispute", amountCents: -3589 } : null, alreadyResolved: false } } },
    { event: fx.transferFailed, state: { type: "transfer.failed", state: { payoutId: "po-1", alreadyFailed: false } } },
    { event: fx.accountUpdated, state: { type: "account.updated", state: { creatorId: "seller", currentKycStatus: "none" } } },
  ];

  for (const { event, state } of cases) {
    it(`${event.type} (${event.id})`, () => {
      const processed = new Set<string>();
      let effectful = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = processEvent(event, state, processed);
        if (result.outcome === "process") {
          effectful += 1;
          expect(result.effects.length).toBeGreaterThan(0);
          processed.add(result.recordEventId); // executor commits this with the effects
        } else {
          expect(result.outcome).toBe("duplicate");
          expect(result.effects).toEqual([]);
        }
      }
      expect(effectful).toBe(1);
    });
  }

  it("a Requeue outcome is NOT recorded as processed — the retry still works", () => {
    const processed = new Set<string>();
    const outOfOrder: HandlerState = { type: "charge.succeeded", state: { order: null, referral: { activeReferrerId: null } } };
    const first = processEvent(fx.chargeSucceeded, outOfOrder, processed);
    expect(first.outcome).toBe("requeue");
    // Order lands, event retries with fresh state — and now processes.
    const retry = processEvent(
      fx.chargeSucceeded,
      { type: "charge.succeeded", state: { order: fx.paidOrder, referral: { activeReferrerId: null } } },
      processed
    );
    expect(retry.outcome).toBe("process");
  });
});
