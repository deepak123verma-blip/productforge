/**
 * The I/O boundary for the safety pipeline. Live implementations
 * (VirusTotal, Google Safe Browsing, Claude Haiku) arrive in Phase 2
 * behind this interface; the pipeline itself never imports a client.
 * MockScanners drives tests and the offline build.
 *
 * MALWARE IS VIRUSTOTAL-ONLY AT LAUNCH (see lib/safety/virustotal.ts and
 * DECISIONS.md "Vercel-only topology"). ClamAV was dropped: clamd is a
 * resident daemon holding ~1GB of signatures in memory — an architectural
 * mismatch with serverless, not a timeout problem. BRING CLAMAV BACK
 * WHEN: VT rate-limit blocks occur on >1% of publishes over a rolling
 * week, or upload volume exceeds ~400 first-seen files/day (VT free tier
 * headroom). It returns as another implementation of this interface on a
 * small always-on host — nothing in the pipeline changes.
 */

export interface FileInput {
  key: string;
  declaredFormat: string; // "pdf" | "xlsx" | ...
  sizeBytes: number;
  /** magic-byte sniff result, provided by the upload layer */
  sniffedFormat: string;
  /** SHA-256 computed at upload — the VT hash-first lookup depends on it. */
  sha256?: string;
  isArchive: boolean;
  archiveDepth?: number;
  archiveExpansionRatio?: number;
}

export interface Scanners {
  scanMalware(file: FileInput): Promise<{ clean: boolean; threat?: string }>;
  checkUrlReputation(url: string): Promise<{ safe: boolean; category?: string }>;
  classifyContent(text: string): Promise<{
    prohibited: boolean;
    prohibitedReason?: string;
    riskClaims: string[];
  }>;
  findDuplicates(input: { coverKey: string | null; text: string }): Promise<{ similarity: number; matchedProductId?: string }>;
}

/** Deterministic mock: trigger words drive outcomes so tests read plainly. */
export class MockScanners implements Scanners {
  async scanMalware(file: FileInput) {
    return file.key.includes("eicar") ? { clean: false, threat: "EICAR-Test-Signature" } : { clean: true };
  }
  async checkUrlReputation(url: string) {
    return url.includes("malware") ? { safe: false, category: "MALWARE" } : { safe: true };
  }
  async classifyContent(text: string) {
    return {
      prohibited: text.includes("PROHIBITED"),
      ...(text.includes("PROHIBITED") ? { prohibitedReason: "prohibited content" } : {}),
      riskClaims: text.includes("guaranteed income") ? ["income guarantee"] : [],
    };
  }
  async findDuplicates(input: { coverKey: string | null; text: string }) {
    return input.text.includes("DUPLICATE") ? { similarity: 0.92, matchedProductId: "p-existing" } : { similarity: 0.05 };
  }
}
