import type { FileInput } from "./scanners";

/**
 * VirusTotal-only malware scanning (launch topology — DECISIONS.md).
 * Strategy: HASH FIRST, UPLOAD SECOND.
 *   1. sha256 lookup — known files decide instantly (the common case).
 *   2. Unknown → upload for analysis, poll with a hard cap.
 * Every failure mode BLOCKS, never passes:
 *   - rate-limit exhaustion (free tier: 4 req/min, 500/day)
 *   - poll cap expiry (the under-10s pipeline budget still applies)
 *   - missing sha256, client errors
 * The HTTP client sits behind VtClient — this module stays pure logic
 * (standing rule: no HTTP client imports here).
 */

export interface VtClient {
  lookupHash(sha256: string): Promise<{ known: boolean; malicious: boolean; threat?: string }>;
  uploadFile(file: FileInput): Promise<{ analysisId: string }>;
  getAnalysis(analysisId: string): Promise<{ status: "queued" | "completed"; malicious: boolean; threat?: string }>;
}

/** Token-bucket over two windows (per-minute and per-day), clock injected. */
export class VtRateLimiter {
  private minuteStamps: number[] = [];
  private dayStamps: number[] = [];

  constructor(
    private readonly nowMs: () => number,
    private readonly perMinute = 4,
    private readonly perDay = 500
  ) {}

  tryAcquire(): boolean {
    const now = this.nowMs();
    this.minuteStamps = this.minuteStamps.filter((t) => now - t < 60_000);
    this.dayStamps = this.dayStamps.filter((t) => now - t < 86_400_000);
    if (this.minuteStamps.length >= this.perMinute || this.dayStamps.length >= this.perDay) {
      return false;
    }
    this.minuteStamps.push(now);
    this.dayStamps.push(now);
    return true;
  }
}

export interface VtScanOptions {
  /** Hard cap on analysis polls for unknown files. Cap expiry BLOCKS. */
  maxPolls?: number;
  sleep?: (ms: number) => Promise<void>;
  pollDelayMs?: number;
}

export type MalwareResult = { clean: boolean; threat?: string };

const BLOCKED_RATE_LIMIT = "VirusTotal rate limit exhausted — publish blocked with retry, never passed";

export function vtMalwareScanner(
  client: VtClient,
  limiter: VtRateLimiter,
  opts: VtScanOptions = {}
): (file: FileInput) => Promise<MalwareResult> {
  const maxPolls = opts.maxPolls ?? 3;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const pollDelayMs = opts.pollDelayMs ?? 1500;

  return async (file: FileInput): Promise<MalwareResult> => {
    if (!file.sha256) {
      return { clean: false, threat: "no sha256 provided by the upload layer — cannot scan, blocked" };
    }

    // 1. Hash first — known files decide immediately.
    if (!limiter.tryAcquire()) return { clean: false, threat: BLOCKED_RATE_LIMIT };
    const byHash = await client.lookupHash(file.sha256);
    if (byHash.known) {
      return byHash.malicious
        ? { clean: false, threat: byHash.threat ?? "known malicious (VT hash match)" }
        : { clean: true };
    }

    // 2. Unknown → upload and poll, hard-capped.
    if (!limiter.tryAcquire()) return { clean: false, threat: BLOCKED_RATE_LIMIT };
    const { analysisId } = await client.uploadFile(file);
    for (let poll = 0; poll < maxPolls; poll++) {
      await sleep(pollDelayMs);
      if (!limiter.tryAcquire()) return { clean: false, threat: BLOCKED_RATE_LIMIT };
      const analysis = await client.getAnalysis(analysisId);
      if (analysis.status === "completed") {
        return analysis.malicious
          ? { clean: false, threat: analysis.threat ?? "malicious (VT analysis)" }
          : { clean: true };
      }
    }
    // Poll cap expired: exactly like a timeout — a block, never a pass.
    return { clean: false, threat: `VT analysis incomplete after ${maxPolls} polls — blocked with retry` };
  };
}
