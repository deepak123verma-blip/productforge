import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../../../../lib/cron/auth";
import { getLockProvider, withLock } from "../../../../lib/cron/lock";
import { runPayoutPreview } from "../../../../lib/money/payout-runner";

/**
 * Weekly payout assembly — Vercel Cron, Monday 09:00 UTC (vercel.json).
 * Assembles the PREVIEW only, in 'pending'. Transfers NEVER fire from
 * here — a human confirms in the admin panel first (money rule 8; the
 * DB state machine enforces pending → confirmed → executing).
 * Advisory-locked and idempotent: re-running over the same period
 * re-derives the same preview from the ledger.
 *
 * TODO(phase-2/3): feed real creators + unpaid ledger entries from the
 * Supabase store (advisory lock per creator inside the run, TRD §3.4).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const run = await withLock(getLockProvider(), "cron:payout-run", async () => {
    const preview = runPayoutPreview([], new Date()); // empty until the live store exists
    return {
      creators: preview.totals.creators,
      netCents: preview.totals.netCents,
      payouts: preview.payouts.length,
      skipped: preview.skipped.length,
      blockedEntries: preview.totals.blockedEntries,
    };
  });
  if (!run.ran) {
    return NextResponse.json({ skipped: "previous run still executing" }, { status: 200 });
  }
  return NextResponse.json({ job: "payout-run", state: "preview_pending_confirmation", ...run.result });
}
