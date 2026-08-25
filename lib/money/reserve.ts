import { assertCents } from "./split";

/**
 * New-creator reserve: a percentage of the period's sales held back during
 * the first 90 days, released when the window ends with dispute rate < 0.5%.
 * Percentages are BASIS POINTS (integer) — 1000 bps = 10%. No float pcts.
 */

export interface ReserveState {
  /** e.g. 1000 for the default 10%; risk tooling may raise to 2000. */
  reserveBps: number;
  /** End of the reserve window; null/past = no hold. */
  reserveUntil: Date | null;
}

export function reserveHold(periodSalesCents: number, state: ReserveState, now: Date): number {
  assertCents(periodSalesCents, "periodSalesCents");
  if (!Number.isSafeInteger(state.reserveBps) || state.reserveBps < 0 || state.reserveBps > 10000) {
    throw new RangeError(`reserveBps out of range: ${state.reserveBps}`);
  }
  if (state.reserveUntil === null || state.reserveUntil.getTime() <= now.getTime()) {
    return 0;
  }
  return Math.floor((periodSalesCents * state.reserveBps) / 10000); // int-div — bps of period sales
}

export interface ReleaseInput {
  /** Sum of prior reserve_hold entries (a negative number, per sign rules). */
  heldCents: number;
  disputeRate90dBps: number; // e.g. 50 = 0.5%
  reserveUntil: Date | null;
}

/**
 * Full release when the window has ended and the 90d dispute rate is under
 * 0.5% (50 bps). Returns the positive reserve_release amount, else 0.
 */
export function reserveRelease(input: ReleaseInput, now: Date): number {
  if (input.heldCents > 0) throw new RangeError("heldCents must be <= 0 (sum of holds)");
  const windowOver = input.reserveUntil === null || input.reserveUntil.getTime() <= now.getTime();
  if (!windowOver) return 0;
  if (input.disputeRate90dBps >= 50) return 0;
  return -input.heldCents;
}
