import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../../../../lib/cron/auth";
import { getLockProvider, withLock } from "../../../../lib/cron/lock";
import { drainOutbox, MockSender } from "../../../../lib/executor/drain";
import { MockStore } from "../../../../lib/executor/mock-store";

/**
 * Outbox drain — Vercel Cron, every minute (vercel.json). Runs under an
 * advisory lock: an every-minute job WILL overlap itself under load.
 * Idempotent (at-least-once senders; claimed rows carry attempts) and it
 * reports what it did — never fire-and-forget.
 *
 * TODO(phase-2): swap MockStore/MockSender for the Supabase-backed Store
 * (claim with FOR UPDATE SKIP LOCKED) and the Resend sender. The drain
 * logic itself (lib/executor/drain.ts) does not change.
 */

const offlineStore = new MockStore(() => Date.now());

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const run = await withLock(getLockProvider(), "cron:outbox-drain", async () =>
    drainOutbox(offlineStore, new MockSender(), { nowMs: Date.now(), limit: 100 })
  );
  if (!run.ran) {
    return NextResponse.json({ skipped: "previous drain still running" }, { status: 200 });
  }
  return NextResponse.json({ job: "outbox-drain", ...run.result });
}
