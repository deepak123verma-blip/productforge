import { reserveHold, type ReserveState } from "./reserve";

/**
 * Pure payout assembly (TRD §3.4 steps 1–5). Takes order state as data —
 * NEVER queries. The DB `payable_orders` view is the runtime enforcer of
 * invariant 4; this function must agree with it exactly:
 *   an order's money is payable only when state='paid', matured, and the
 *   product's review has cleared. Referral entries mature one day AFTER
 *   the parent order (ruling A2 — derived from the order, never stored).
 */

export interface OrderFacts {
  state: "paid" | "refunded" | "disputed" | "reversed";
  maturesAt: Date;
  reviewState: "pending" | "cleared" | "rejected";
}

export interface PayoutCandidateEntry {
  id: number;
  type:
    | "sale"
    | "refund"
    | "dispute"
    | "referral"
    | "referral_reversal"
    | "reserve_release"
    | "adjustment";
  amountCents: number;
  /** Facts about the parent order; null for order-less entries (e.g. reserve_release). */
  order: OrderFacts | null;
  /** Already paid out? (payout_id stamped) — must never re-enter a payout. */
  payoutId: string | null;
}

export interface CreatorPayoutFacts {
  creatorId: string;
  kycStatus: "none" | "pending" | "verified" | "restricted" | "rejected";
  payoutsPaused: boolean;
  reserve: ReserveState;
}

export const MINIMUM_TRANSFER_CENTS = 1000; // $10 — TRD §3.4 step 4

const DAY_MS = 86_400_000;

export type PayoutResult =
  | {
      kind: "payout";
      creatorId: string;
      salesCents: number;
      referralCents: number;
      clawedCents: number;
      reserveHeldCents: number;
      netCents: number;
      constituentEntryIds: number[];
      /** Entry ids excluded because their order is immature or review-pending. */
      blockedEntryIds: number[];
    }
  | { kind: "skip"; creatorId: string; reason: string; blockedEntryIds: number[] };

function entryIsPayable(e: PayoutCandidateEntry, now: Date): boolean {
  if (e.payoutId !== null) return false; // already paid — never twice
  if (e.order === null) return true; // e.g. reserve_release, standalone adjustment
  // Clawbacks (refund/dispute/reversal) always enter immediately — they only
  // ever reduce the payout; delaying them would overpay.
  if (e.amountCents < 0) return true;
  if (e.order.state !== "paid") return false;
  if (e.order.reviewState !== "cleared") return false;
  const maturity =
    e.type === "referral"
      ? e.order.maturesAt.getTime() + DAY_MS // referral matures AFTER the referee (A2)
      : e.order.maturesAt.getTime();
  return maturity <= now.getTime();
}

export function assemblePayout(
  entries: readonly PayoutCandidateEntry[],
  creator: CreatorPayoutFacts,
  now: Date
): PayoutResult {
  const payable: PayoutCandidateEntry[] = [];
  const blocked: number[] = [];
  for (const e of entries) {
    if (e.payoutId !== null) continue;
    if (entryIsPayable(e, now)) payable.push(e);
    else blocked.push(e.id);
  }

  if (creator.payoutsPaused) {
    return { kind: "skip", creatorId: creator.creatorId, reason: "payouts_paused", blockedEntryIds: blocked };
  }
  if (creator.kycStatus !== "verified") {
    return { kind: "skip", creatorId: creator.creatorId, reason: "kyc_not_verified", blockedEntryIds: blocked };
  }

  let salesCents = 0;
  let referralCents = 0;
  let clawedCents = 0;
  for (const e of payable) {
    if (e.type === "sale") salesCents += e.amountCents;
    else if (e.type === "referral") referralCents += e.amountCents;
    else if (e.amountCents < 0) clawedCents += -e.amountCents;
    else salesCents += e.amountCents; // reserve_release / positive adjustment
  }

  const reserveHeldCents = reserveHold(salesCents, creator.reserve, now);
  const netCents = salesCents + referralCents - clawedCents - reserveHeldCents;

  if (netCents <= 0) {
    return { kind: "skip", creatorId: creator.creatorId, reason: "non_positive_balance", blockedEntryIds: blocked };
  }
  if (netCents < MINIMUM_TRANSFER_CENTS) {
    return { kind: "skip", creatorId: creator.creatorId, reason: "below_minimum_transfer", blockedEntryIds: blocked };
  }

  return {
    kind: "payout",
    creatorId: creator.creatorId,
    salesCents,
    referralCents,
    clawedCents,
    reserveHeldCents,
    netCents,
    constituentEntryIds: payable.map((e) => e.id),
    blockedEntryIds: blocked,
  };
}
