import type { AccountUpdated, Effect } from "./types";

export interface AccountUpdatedState {
  creatorId: string | null;
  currentKycStatus: "none" | "pending" | "verified" | "restricted" | "rejected";
}

function statusFrom(e: AccountUpdated["data"]): "pending" | "verified" | "restricted" {
  if (e.disabledReason !== null) return "restricted";
  if (e.detailsSubmitted && e.payoutsEnabled) return "verified";
  return "pending";
}

/** Sync kyc_status from Connect account state. No change → no effect. */
export function handleAccountUpdated(event: AccountUpdated, state: AccountUpdatedState): Effect[] {
  if (state.creatorId === null) {
    return [{ kind: "Requeue", reason: `no creator for account ${event.data.accountId}` }];
  }
  const next = statusFrom(event.data);
  if (next === state.currentKycStatus) return [];
  return [{ kind: "UpdateKycStatus", creatorId: state.creatorId, kycStatus: next }];
}
