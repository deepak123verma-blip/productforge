import { assemblePayout, type CreatorPayoutFacts, type PayoutCandidateEntry, type PayoutResult } from "./payout";

/**
 * The weekly run, pure (TRD §3.4 steps 1–5): creators + ledgers + now →
 * preview rows in 'pending'. Execution (confirm → executing → transfers)
 * is the executor's job and NEVER fires without human confirmation —
 * the DB state machine from migration 0002 enforces the path; the
 * transition helper below mirrors it for UI convenience only (the DB
 * remains the enforcer — verify, don't trust this copy).
 */

export interface RunInput {
  creator: CreatorPayoutFacts;
  entries: PayoutCandidateEntry[];
}

export interface RunPreview {
  payouts: Extract<PayoutResult, { kind: "payout" }>[];
  skipped: Extract<PayoutResult, { kind: "skip" }>[];
  totals: { creators: number; netCents: number; blockedEntries: number };
}

export function runPayoutPreview(inputs: readonly RunInput[], now: Date): RunPreview {
  const payouts: RunPreview["payouts"] = [];
  const skipped: RunPreview["skipped"] = [];
  for (const { creator, entries } of inputs) {
    const result = assemblePayout(entries, creator, now);
    if (result.kind === "payout") payouts.push(result);
    else skipped.push(result);
  }
  const netCents = payouts.reduce((s, p) => s + p.netCents, 0);
  const blockedEntries =
    payouts.reduce((s, p) => s + p.blockedEntryIds.length, 0) +
    skipped.reduce((s, p) => s + p.blockedEntryIds.length, 0);
  return { payouts, skipped, totals: { creators: inputs.length, netCents, blockedEntries } };
}

export type PayoutState = "pending" | "confirmed" | "executing" | "sent" | "failed";

const LEGAL: Record<PayoutState, PayoutState[]> = {
  pending: ["confirmed"],
  confirmed: ["executing"],
  executing: ["sent", "failed"],
  sent: [],
  failed: [], // terminal per run; retries are NEW rows next run
};

/** UI convenience mirror of trg_payout_state_machine. The DB decides. */
export function canTransition(from: PayoutState, to: PayoutState): boolean {
  return LEGAL[from].includes(to);
}
