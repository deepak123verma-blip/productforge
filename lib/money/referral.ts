import { assertCents } from "./split";

/**
 * Referrals pay 5% of PLATFORM revenue (never of the creator's sales).
 * PRD §8.1. Floored, so the referral never exceeds 5%.
 */
export function referralAmount(platformCents: number): number {
  assertCents(platformCents, "platformCents");
  return Math.floor(platformCents * 0.05); // ratio — 5% of platform revenue
}
