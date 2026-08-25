import { describe, expect, it } from "vitest";
import { matchSourceLink } from "../../lib/attribution/match";
import { canTransition, runPayoutPreview, type RunInput } from "../../lib/money/payout-runner";
import type { PayoutCandidateEntry } from "../../lib/money/payout";

const NOW = new Date("2026-08-25T00:00:00Z");
const DAY_MS = 86_400_000;

function saleEntry(id: number, amountCents: number, opts: { matured?: boolean; cleared?: boolean } = {}): PayoutCandidateEntry {
  return {
    id,
    type: "sale",
    amountCents,
    order: {
      state: "paid",
      maturesAt: new Date(NOW.getTime() + (opts.matured === false ? DAY_MS : -DAY_MS)),
      reviewState: opts.cleared === false ? "pending" : "cleared",
    },
    payoutId: null,
  };
}

const verified = {
  kycStatus: "verified" as const,
  payoutsPaused: false,
  reserve: { reserveBps: 0, reserveUntil: null },
};

describe("attribution matching", () => {
  const exists = (id: string) => id === "l-1" || id === "l-2";

  it("metadata wins when valid", () => {
    expect(matchSourceLink({ metadataLinkId: "l-1", cookieLinkId: "l-2", linkExists: exists })).toBe("l-1");
  });
  it("falls back to the cookie when metadata is dead", () => {
    expect(matchSourceLink({ metadataLinkId: "l-deleted", cookieLinkId: "l-2", linkExists: exists })).toBe("l-2");
  });
  it("an unmatched order is null — Direct, never guessed", () => {
    expect(matchSourceLink({ metadataLinkId: null, cookieLinkId: null, linkExists: exists })).toBeNull();
    expect(matchSourceLink({ metadataLinkId: "l-gone", cookieLinkId: "l-gone", linkExists: exists })).toBeNull();
  });
});

describe("payout runner", () => {
  it("produces previews and skips per the rules, totals reconcile", () => {
    const inputs: RunInput[] = [
      { creator: { creatorId: "ok", ...verified }, entries: [saleEntry(1, 5000)] },
      { creator: { creatorId: "paused", ...verified, payoutsPaused: true }, entries: [saleEntry(2, 5000)] },
      { creator: { creatorId: "unverified", ...verified, kycStatus: "pending" }, entries: [saleEntry(3, 5000)] },
      { creator: { creatorId: "tiny", ...verified }, entries: [saleEntry(4, 500)] }, // < $10
      { creator: { creatorId: "negative", ...verified }, entries: [{ id: 5, type: "refund", amountCents: -900, order: null, payoutId: null }] },
      { creator: { creatorId: "immature", ...verified }, entries: [saleEntry(6, 5000, { matured: false })] },
      { creator: { creatorId: "unreviewed", ...verified }, entries: [saleEntry(7, 5000, { cleared: false })] },
    ];
    const preview = runPayoutPreview(inputs, NOW);

    expect(preview.payouts.map((p) => p.creatorId)).toEqual(["ok"]);
    expect(preview.skipped.map((s) => `${s.creatorId}:${s.reason}`)).toEqual([
      "paused:payouts_paused",
      "unverified:kyc_not_verified",
      "tiny:below_minimum_transfer",
      "negative:non_positive_balance",
      "immature:non_positive_balance",
      "unreviewed:non_positive_balance",
    ]);
    expect(preview.totals.netCents).toBe(5000);
    // The immature and unreviewed entries were blocked, never included.
    expect(preview.totals.blockedEntries).toBe(2);
  });

  it("never includes an immature or unreviewed entry even for a paying creator", () => {
    const preview = runPayoutPreview(
      [{
        creator: { creatorId: "mixed", ...verified },
        entries: [saleEntry(1, 5000), saleEntry(2, 7000, { matured: false }), saleEntry(3, 9000, { cleared: false })],
      }],
      NOW
    );
    const p = preview.payouts[0]!;
    expect(p.constituentEntryIds).toEqual([1]);
    expect(p.blockedEntryIds.sort()).toEqual([2, 3]);
    expect(p.netCents).toBe(5000);
  });

  it("mirrors the DB payout state machine exactly", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "executing")).toBe(true);
    expect(canTransition("executing", "sent")).toBe(true);
    expect(canTransition("executing", "failed")).toBe(true);
    // everything else is illegal
    expect(canTransition("pending", "executing")).toBe(false);
    expect(canTransition("pending", "sent")).toBe(false);
    expect(canTransition("confirmed", "sent")).toBe(false);
    expect(canTransition("failed", "executing")).toBe(false);
    expect(canTransition("sent", "failed")).toBe(false);
  });
});
