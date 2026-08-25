import { describe, expect, it } from "vitest";
import { computeSplit } from "../../lib/money/split";
import {
  entriesForSale,
  entriesForRefund,
  entriesForDispute,
  balanceOf,
  type LedgerEntryDraft,
} from "../../lib/money/ledger";
import {
  assemblePayout,
  type PayoutCandidateEntry,
  type OrderFacts,
} from "../../lib/money/payout";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s;
  };
}

const SEED = 0xbeefcafe;
const ORDERS = 1000;
const NOW = new Date("2026-08-25T00:00:00Z");
const DAY_MS = 86_400_000;

interface SimEntry extends PayoutCandidateEntry {
  draft: LedgerEntryDraft;
}

describe("ledger simulation — 1,000 orders with random refunds and disputes", () => {
  it("balance reconciles and no immature or unreviewed order enters a payout", () => {
    const next = lcg(SEED);
    const all: SimEntry[] = [];
    let id = 0;
    let expectedSellerBalance = 0;
    let expectedReferrerBalance = 0;

    for (let i = 0; i < ORDERS; i++) {
      const gross = 500 + (next() % 99_501);
      const processing = next() % Math.min(gross, 2000);
      const { creator, platform } = computeSplit(gross, processing);
      const hasReferrer = next() % 4 === 0;
      const ageDays = next() % 30; // 0..29 days old → some immature (T+14)
      const reviewState: OrderFacts["reviewState"] =
        next() % 10 === 0 ? "pending" : "cleared";
      const fate = next() % 20; // 0 → refund, 1 → dispute, else stays paid

      const sale = entriesForSale({
        sellerCreatorId: "seller",
        orderId: `order-${i}`,
        creatorCents: creator,
        platformCents: platform,
        activeReferrerId: hasReferrer ? "referrer" : null,
      });

      const orderFacts: OrderFacts = {
        state: fate === 0 ? "refunded" : fate === 1 ? "disputed" : "paid",
        maturesAt: new Date(NOW.getTime() - ageDays * DAY_MS + 14 * DAY_MS),
        reviewState,
      };

      let drafts = [...sale];
      if (fate === 0) drafts = [...drafts, ...entriesForRefund(sale)];
      if (fate === 1) drafts = [...drafts, ...entriesForDispute(sale)];

      for (const d of drafts) {
        all.push({ id: id++, type: d.type as SimEntry["type"], amountCents: d.amountCents, order: orderFacts, payoutId: null, draft: d });
        if (d.creatorId === "seller") expectedSellerBalance += d.amountCents;
        else expectedReferrerBalance += d.amountCents;
      }
    }

    // 1. Balance is exactly the sum of the ledger, per creator.
    const sellerEntries = all.filter((e) => e.draft.creatorId === "seller");
    const referrerEntries = all.filter((e) => e.draft.creatorId === "referrer");
    expect(balanceOf(sellerEntries.map((e) => e.draft))).toBe(expectedSellerBalance);
    expect(balanceOf(referrerEntries.map((e) => e.draft))).toBe(expectedReferrerBalance);

    // 2. Assemble a payout for the seller and audit every constituent.
    const result = assemblePayout(
      sellerEntries,
      {
        creatorId: "seller",
        kycStatus: "verified",
        payoutsPaused: false,
        reserve: { reserveBps: 1000, reserveUntil: new Date(NOW.getTime() + 30 * DAY_MS) },
      },
      NOW
    );
    expect(result.kind).toBe("payout");
    if (result.kind !== "payout") return;

    const byId = new Map(all.map((e) => [e.id, e]));
    for (const cid of result.constituentEntryIds) {
      const e = byId.get(cid)!;
      if (e.amountCents > 0 && e.order !== null) {
        // No immature, unreviewed, or non-paid order money ever pays out.
        expect(e.order.state).toBe("paid");
        expect(e.order.reviewState).toBe("cleared");
        const maturity =
          e.type === "referral" ? e.order.maturesAt.getTime() + DAY_MS : e.order.maturesAt.getTime();
        expect(maturity).toBeLessThanOrEqual(NOW.getTime());
      }
    }

    // 3. The payout's own arithmetic reconciles.
    expect(result.netCents).toBe(
      result.salesCents + result.referralCents - result.clawedCents - result.reserveHeldCents
    );
    expect(result.netCents).toBeGreaterThan(0);

    // 4. Blocked + constituent = every unpaid entry, nothing lost.
    expect(result.constituentEntryIds.length + result.blockedEntryIds.length).toBe(
      sellerEntries.length
    );
  });

  it("skips: paused, unverified, and below-minimum creators never pay out", () => {
    const entry: PayoutCandidateEntry = {
      id: 1,
      type: "sale",
      amountCents: 500,
      order: { state: "paid", maturesAt: new Date(NOW.getTime() - DAY_MS), reviewState: "cleared" },
      payoutId: null,
    };
    const base = {
      creatorId: "c",
      kycStatus: "verified" as const,
      payoutsPaused: false,
      reserve: { reserveBps: 0, reserveUntil: null },
    };
    expect(assemblePayout([entry], { ...base, payoutsPaused: true }, NOW).kind).toBe("skip");
    expect(assemblePayout([entry], { ...base, kycStatus: "pending" }, NOW).kind).toBe("skip");
    // 500¢ < $10 minimum
    expect(assemblePayout([entry], base, NOW)).toMatchObject({ kind: "skip", reason: "below_minimum_transfer" });
  });
});
