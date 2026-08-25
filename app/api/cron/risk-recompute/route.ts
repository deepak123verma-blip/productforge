import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../../../../lib/cron/auth";
import { getLockProvider, withLock } from "../../../../lib/cron/lock";

/**
 * Nightly risk recompute — Vercel Cron, 03:00 UTC (vercel.json).
 * Recomputes per-creator dispute rates (30/60/90d) and applies the
 * automatic actions from PRD §7.3 (sub-$9 restriction above 0.5%,
 * payout pause above 1%). Advisory-locked, idempotent — the rates are
 * derived from orders, so recomputing is always safe.
 *
 * TODO(phase-2): the actual recompute lands with the Supabase store;
 * this route is the scheduled shell reporting what it did.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const run = await withLock(getLockProvider(), "cron:risk-recompute", async () => ({
    creatorsRecomputed: 0,
    restricted: 0,
    payoutsPaused: 0,
  }));
  if (!run.ran) {
    return NextResponse.json({ skipped: "previous recompute still running" }, { status: 200 });
  }
  return NextResponse.json({ job: "risk-recompute", ...run.result });
}
