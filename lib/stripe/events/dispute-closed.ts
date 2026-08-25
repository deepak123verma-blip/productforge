import { entryForDisputeWon, type LedgerEntryDraft } from "../../money/ledger";
import type { DisputeClosed, Effect } from "./types";

export interface DisputeClosedState {
  /** Does the dispute row exist yet? closed can arrive before created — requeue. */
  disputeExists: boolean;
  /** The original dispute debit entry (type='dispute'), if one was written. */
  disputeEntry: LedgerEntryDraft | null;
  alreadyResolved: boolean;
}

/**
 * Won → restoring adjustment exactly equal to the original debit.
 * Lost / warning_closed → the debit stands; only the dispute row resolves.
 */
export function handleDisputeClosed(event: DisputeClosed, state: DisputeClosedState): Effect[] {
  if (!state.disputeExists) {
    // Stripe can deliver closed before created — park it, never fail.
    return [{ kind: "Requeue", reason: `no dispute row for ${event.data.disputeId}` }];
  }
  if (state.alreadyResolved) return []; // replay

  const effects: Effect[] = [
    { kind: "ResolveDispute", stripeDisputeId: event.data.disputeId, outcome: event.data.status },
  ];
  if (event.data.status === "won" && state.disputeEntry !== null) {
    effects.push({ kind: "InsertLedgerEntries", entries: [entryForDisputeWon(state.disputeEntry)] });
  }
  return effects;
}
