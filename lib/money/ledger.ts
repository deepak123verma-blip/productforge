import { assertCents } from "./split";
import { referralAmount } from "./referral";

/**
 * Pure builders for ledger entries. Sign discipline mirrors the DB CHECKs
 * (credits > 0 for sale/referral/reserve_release; debits < 0 for refund/
 * dispute/referral_reversal/reserve_hold/payout). The DB is the enforcer;
 * these builders just never produce a row it would reject.
 *
 * A sale and its paired referral MUST be inserted in ONE transaction —
 * these builders return the pair; the write path owns atomicity.
 */

export type LedgerType =
  | "sale"
  | "refund"
  | "dispute"
  | "referral"
  | "referral_reversal"
  | "reserve_hold"
  | "reserve_release"
  | "payout"
  | "adjustment";

export interface LedgerEntryDraft {
  creatorId: string;
  orderId: string | null;
  type: LedgerType;
  amountCents: number;
  referralOfCreatorId: string | null;
  memo: string | null;
}

/** The $15 chargeback fee, shared into the creator's debit. */
export const DISPUTE_FEE_CENTS = 1500;

export interface SaleContext {
  sellerCreatorId: string;
  orderId: string;
  creatorCents: number;
  platformCents: number;
  /** Referrer inside their live 12-month window, or null. Resolved by the caller. */
  activeReferrerId: string | null;
}

/** The paired write for a sale: [sale, referral?]. Insert atomically. */
export function entriesForSale(ctx: SaleContext): LedgerEntryDraft[] {
  assertCents(ctx.creatorCents, "creatorCents");
  assertCents(ctx.platformCents, "platformCents");
  if (ctx.creatorCents <= 0) {
    throw new RangeError("a sale entry must be strictly positive");
  }
  const out: LedgerEntryDraft[] = [
    {
      creatorId: ctx.sellerCreatorId,
      orderId: ctx.orderId,
      type: "sale",
      amountCents: ctx.creatorCents,
      referralOfCreatorId: null,
      memo: null,
    },
  ];
  if (ctx.activeReferrerId !== null && ctx.activeReferrerId !== ctx.sellerCreatorId) {
    const amount = referralAmount(ctx.platformCents);
    if (amount > 0) {
      out.push({
        creatorId: ctx.activeReferrerId,
        orderId: ctx.orderId,
        type: "referral",
        amountCents: amount,
        referralOfCreatorId: ctx.sellerCreatorId,
        memo: "5% of platform revenue",
      });
    }
  }
  return out;
}

/**
 * The paired reversal for a refund. Mirrors entriesForSale exactly:
 * if a referral was written, its reversal rides the same transaction.
 */
export function entriesForRefund(saleEntries: LedgerEntryDraft[]): LedgerEntryDraft[] {
  return reverse(saleEntries, "refund", "referral_reversal", 0);
}

/** The paired reversal for a dispute: the sale amount plus the $15 fee share. */
export function entriesForDispute(saleEntries: LedgerEntryDraft[]): LedgerEntryDraft[] {
  return reverse(saleEntries, "dispute", "referral_reversal", DISPUTE_FEE_CENTS);
}

/** A won dispute restores the disputed amount (fee included) as an adjustment. */
export function entryForDisputeWon(disputeEntry: LedgerEntryDraft): LedgerEntryDraft {
  if (disputeEntry.type !== "dispute") {
    throw new TypeError("entryForDisputeWon takes the original dispute entry");
  }
  return {
    creatorId: disputeEntry.creatorId,
    orderId: disputeEntry.orderId,
    type: "adjustment",
    amountCents: -disputeEntry.amountCents,
    referralOfCreatorId: null,
    memo: "dispute won — amount restored",
  };
}

function reverse(
  saleEntries: LedgerEntryDraft[],
  saleReversalType: "refund" | "dispute",
  referralReversalType: "referral_reversal",
  extraFeeCents: number
): LedgerEntryDraft[] {
  return saleEntries.map((e) => {
    if (e.type === "sale") {
      return {
        creatorId: e.creatorId,
        orderId: e.orderId,
        type: saleReversalType,
        amountCents: -(e.amountCents + extraFeeCents),
        referralOfCreatorId: null,
        memo: null,
      };
    }
    if (e.type === "referral") {
      return {
        creatorId: e.creatorId,
        orderId: e.orderId,
        type: referralReversalType,
        amountCents: -e.amountCents,
        referralOfCreatorId: e.referralOfCreatorId,
        memo: null,
      };
    }
    throw new TypeError(`cannot reverse a ${e.type} entry through this path`);
  });
}

/** Balance is ALWAYS a sum over entries — never stored (CLAUDE.md rule 3). */
export function balanceOf(entries: readonly Pick<LedgerEntryDraft, "amountCents">[]): number {
  let sum = 0;
  for (const e of entries) sum += e.amountCents;
  return sum;
}
