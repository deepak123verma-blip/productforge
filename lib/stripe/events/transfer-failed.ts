import type { Effect, TransferFailed } from "./types";

export interface TransferFailedState {
  /** The payout row carrying this stripe_transfer_id, if any. */
  payoutId: string | null;
  alreadyFailed: boolean;
}

/**
 * Payout → failed with the reason. Terminal for this row: the next weekly
 * run assembles a NEW payout for the still-unpaid entries (migration 0002).
 */
export function handleTransferFailed(event: TransferFailed, state: TransferFailedState): Effect[] {
  if (state.payoutId === null) {
    return [{ kind: "Requeue", reason: `no payout for transfer ${event.data.transferId}` }];
  }
  if (state.alreadyFailed) return []; // replay
  return [
    { kind: "UpdatePayoutState", payoutId: state.payoutId, state: "failed", failureReason: event.data.failureMessage },
  ];
}
