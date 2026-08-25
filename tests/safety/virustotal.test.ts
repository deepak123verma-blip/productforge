import { describe, expect, it } from "vitest";
import { vtMalwareScanner, VtRateLimiter, type VtClient } from "../../lib/safety/virustotal";
import type { FileInput } from "../../lib/safety/scanners";

const T0 = Date.parse("2026-08-25T00:00:00Z");
const file = (sha256?: string): FileInput => ({
  key: "k/guide.pdf",
  declaredFormat: "pdf",
  sniffedFormat: "pdf",
  sizeBytes: 900_000,
  isArchive: false,
  ...(sha256 !== undefined ? { sha256 } : {}),
});

const noSleep = { sleep: async () => {}, pollDelayMs: 0 };

function client(overrides: Partial<VtClient> = {}): VtClient {
  return {
    lookupHash: async () => ({ known: true, malicious: false }),
    uploadFile: async () => ({ analysisId: "an_1" }),
    getAnalysis: async () => ({ status: "completed", malicious: false }),
    ...overrides,
  };
}

function limiter(nowMs: () => number, perMinute = 4, perDay = 500) {
  return new VtRateLimiter(nowMs, perMinute, perDay);
}

describe("VirusTotal-only malware scanning — hash first, upload second", () => {
  it("known-clean hash passes on one request", async () => {
    const scan = vtMalwareScanner(client(), limiter(() => T0), noSleep);
    expect(await scan(file("abc"))).toEqual({ clean: true });
  });

  it("known-malicious hash blocks instantly", async () => {
    const scan = vtMalwareScanner(
      client({ lookupHash: async () => ({ known: true, malicious: true, threat: "EICAR" }) }),
      limiter(() => T0),
      noSleep
    );
    expect(await scan(file("abc"))).toEqual({ clean: false, threat: "EICAR" });
  });

  it("unknown hash uploads, polls, and returns the analysis verdict", async () => {
    let polls = 0;
    const scan = vtMalwareScanner(
      client({
        lookupHash: async () => ({ known: false, malicious: false }),
        getAnalysis: async () => (++polls < 2 ? { status: "queued", malicious: false } : { status: "completed", malicious: true, threat: "Trojan.Gen" }),
      }),
      limiter(() => T0),
      noSleep
    );
    expect(await scan(file("abc"))).toEqual({ clean: false, threat: "Trojan.Gen" });
    expect(polls).toBe(2);
  });

  it("POLL CAP EXPIRY IS A BLOCK, never a pass", async () => {
    const scan = vtMalwareScanner(
      client({
        lookupHash: async () => ({ known: false, malicious: false }),
        getAnalysis: async () => ({ status: "queued", malicious: false }),
      }),
      limiter(() => T0, 100), // ample budget: this test is about the poll cap
      { ...noSleep, maxPolls: 3 }
    );
    const result = await scan(file("abc"));
    expect(result.clean).toBe(false);
    expect(result.threat).toContain("incomplete after 3 polls");
  });

  it("RATE-LIMIT EXHAUSTION IS A BLOCK, never a pass — and recovers when the window rolls", async () => {
    let now = T0;
    const lim = limiter(() => now, 2, 500); // tiny per-minute budget
    const scan = vtMalwareScanner(client(), lim, noSleep);

    expect((await scan(file("a"))).clean).toBe(true);
    expect((await scan(file("b"))).clean).toBe(true);
    // Third request in the same minute: budget gone.
    const blocked = await scan(file("c"));
    expect(blocked.clean).toBe(false);
    expect(blocked.threat).toContain("rate limit exhausted");
    // A minute later the window rolls and scanning resumes.
    now = T0 + 61_000;
    expect((await scan(file("d"))).clean).toBe(true);
  });

  it("daily budget exhaustion blocks even when the minute window is clear", async () => {
    let now = T0;
    const lim = limiter(() => now, 4, 1); // one request per day
    const scan = vtMalwareScanner(client(), lim, noSleep);
    expect((await scan(file("a"))).clean).toBe(true);
    now = T0 + 5 * 60_000; // minute window clear, day budget spent
    const blocked = await scan(file("b"));
    expect(blocked.clean).toBe(false);
    expect(blocked.threat).toContain("rate limit exhausted");
  });

  it("exhaustion mid-poll blocks rather than passing an unfinished analysis", async () => {
    const now = T0;
    const lim = limiter(() => now, 2, 500); // hash + upload spend the whole minute budget
    const scan = vtMalwareScanner(
      client({ lookupHash: async () => ({ known: false, malicious: false }) }),
      lim,
      noSleep
    );
    const result = await scan(file("a"));
    expect(result.clean).toBe(false);
    expect(result.threat).toContain("rate limit exhausted");
  });

  it("a file with no sha256 blocks", async () => {
    const scan = vtMalwareScanner(client(), limiter(() => T0), noSleep);
    const result = await scan(file(undefined));
    expect(result.clean).toBe(false);
    expect(result.threat).toContain("no sha256");
  });
});
