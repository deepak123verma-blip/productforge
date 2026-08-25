import { describe, expect, it } from "vitest";
import {
  entriesForSale,
  entriesForRefund,
  entriesForDispute,
  entryForDisputeWon,
  balanceOf,
  DISPUTE_FEE_CENTS,
} from "../../lib/money/ledger";

const SELLER = "seller-1";
const REFERRER = "referrer-1";

function sale(activeReferrerId: string | null) {
  return entriesForSale({
    sellerCreatorId: SELLER,
    orderId: "order-1",
    creatorCents: 2089,
    platformCents: 697,
    activeReferrerId,
  });
}

describe("referral pairing", () => {
  it("a referral-eligible sale produces exactly the pair", () => {
    const pair = sale(REFERRER);
    expect(pair).toHaveLength(2);
    expect(pair[0]).toMatchObject({ type: "sale", creatorId: SELLER, amountCents: 2089 });
    expect(pair[1]).toMatchObject({
      type: "referral",
      creatorId: REFERRER,
      referralOfCreatorId: SELLER,
      amountCents: 34, // floor(697 × 0.05)
    });
  });

  it("no referrer → sale entry only", () => {
    expect(sale(null)).toHaveLength(1);
  });

  it("self-referral produces no referral entry", () => {
    expect(sale(SELLER)).toHaveLength(1);
  });

  it("earn then refund: reversal is exact and paired, net zero", () => {
    const earned = sale(REFERRER);
    const reversed = entriesForRefund(earned);
    expect(reversed).toHaveLength(2);
    expect(reversed[0]).toMatchObject({ type: "refund", amountCents: -2089 });
    expect(reversed[1]).toMatchObject({
      type: "referral_reversal",
      creatorId: REFERRER,
      referralOfCreatorId: SELLER,
      amountCents: -34,
    });
    expect(balanceOf([...earned, ...reversed])).toBe(0);
  });

  it("dispute adds the $15 fee share to the creator debit, referral reversal stays exact", () => {
    const earned = sale(REFERRER);
    const reversed = entriesForDispute(earned);
    expect(reversed[0]).toMatchObject({ type: "dispute", amountCents: -(2089 + DISPUTE_FEE_CENTS) });
    expect(reversed[1]).toMatchObject({ type: "referral_reversal", amountCents: -34 });
    const won = entryForDisputeWon(reversed[0]!);
    expect(won.amountCents).toBe(2089 + DISPUTE_FEE_CENTS);
  });

  it("a referral never exceeds 5% of platform revenue", () => {
    for (let platform = 0; platform <= 5000; platform += 7) {
      const pair = entriesForSale({
        sellerCreatorId: SELLER,
        orderId: "o",
        creatorCents: 1,
        platformCents: platform,
        activeReferrerId: REFERRER,
      });
      const referral = pair.find((e) => e.type === "referral");
      const amount = referral ? referral.amountCents : 0;
      expect(amount * 20).toBeLessThanOrEqual(platform); // amount <= platform × 5%
    }
  });
});
