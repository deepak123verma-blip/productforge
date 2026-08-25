import { describe, expect, it } from "vitest";
import { decide, type CheckOutcome, type CheckResult } from "../../lib/safety/decision";
import { runPipeline, type PipelineInput } from "../../lib/safety/pipeline";
import { MockScanners, type FileInput, type Scanners } from "../../lib/safety/scanners";

const cleanPdf: FileInput = {
  key: "k/guide.pdf",
  declaredFormat: "pdf",
  sniffedFormat: "pdf",
  sizeBytes: 900_000,
  isArchive: false,
};

const baseInput: PipelineInput = {
  files: [cleanPdf],
  linkUrls: ["https://canva.com/design/x"],
  title: "30-Day Growth Kit",
  description: "A planner and hooks.",
  extractedText: "plan your month",
  coverKey: null,
};

function outcome(check: CheckOutcome["check"], result: CheckResult): CheckOutcome {
  return { check, result, detail: "t" };
}

describe("decision matrix — exhaustive over result combinations", () => {
  const checks: CheckOutcome["check"][] = ["integrity", "malware", "risk_claims", "duplicate"];
  const results: CheckResult[] = ["pass", "flag", "fail"];

  // Every combination of 4 checks × 3 results = 81 cases.
  for (const a of results) for (const b of results) for (const c of results) for (const d of results) {
    const combo = [a, b, c, d] as const;
    const expected = combo.includes("fail") ? "block" : combo.includes("flag") ? "publish_flagged" : "publish";
    it(`[${combo.join(",")}] → ${expected}`, () => {
      const outcomes = combo.map((r, i) => outcome(checks[i]!, r));
      expect(decide(outcomes).decision).toBe(expected);
    });
  }

  it("block reasons name every failing check", () => {
    const v = decide([outcome("malware", "fail"), outcome("integrity", "fail"), outcome("duplicate", "flag")]);
    expect(v).toMatchObject({ decision: "block" });
    if (v.decision === "block") expect(v.reasons).toHaveLength(2);
  });
});

describe("pipeline", () => {
  it("clean product → publish", async () => {
    const run = await runPipeline(baseInput, new MockScanners());
    expect(run.verdict.decision).toBe("publish");
  });

  it("EICAR file → block", async () => {
    const run = await runPipeline(
      { ...baseInput, files: [{ ...cleanPdf, key: "k/eicar.pdf" }] },
      new MockScanners()
    );
    expect(run.verdict).toMatchObject({ decision: "block" });
  });

  it("type mismatch (exe declared as pdf) → block", async () => {
    const run = await runPipeline(
      { ...baseInput, files: [{ ...cleanPdf, sniffedFormat: "exe" }] },
      new MockScanners()
    );
    expect(run.verdict.decision).toBe("block");
  });

  it("zip bomb (expansion ratio > 100×) → block", async () => {
    const run = await runPipeline(
      { ...baseInput, files: [{ ...cleanPdf, declaredFormat: "zip", sniffedFormat: "zip", isArchive: true, archiveDepth: 1, archiveExpansionRatio: 500 }] },
      new MockScanners()
    );
    expect(run.verdict.decision).toBe("block");
  });

  it("bad link URL → block", async () => {
    const run = await runPipeline({ ...baseInput, linkUrls: ["https://malware.example.com"] }, new MockScanners());
    expect(run.verdict.decision).toBe("block");
  });

  it("risk claim → publish_flagged, never block", async () => {
    const run = await runPipeline({ ...baseInput, description: "guaranteed income in 30 days" }, new MockScanners());
    expect(run.verdict).toMatchObject({ decision: "publish_flagged" });
  });

  it("duplicate → publish_flagged", async () => {
    const run = await runPipeline({ ...baseInput, extractedText: "DUPLICATE content" }, new MockScanners());
    expect(run.verdict).toMatchObject({ decision: "publish_flagged" });
  });

  it("A HANGING SCANNER TIMES OUT AND BLOCKS — never passes", async () => {
    const hanging: Scanners = {
      ...new MockScanners(),
      scanMalware: () => new Promise(() => {}), // never resolves
      checkUrlReputation: new MockScanners().checkUrlReputation.bind(new MockScanners()),
      classifyContent: new MockScanners().classifyContent.bind(new MockScanners()),
      findDuplicates: new MockScanners().findDuplicates.bind(new MockScanners()),
    };
    const run = await runPipeline(baseInput, hanging);
    expect(run.verdict.decision).toBe("block");
    const malware = run.outcomes.find((o) => o.check === "malware");
    expect(malware?.result).toBe("fail");
    expect(malware?.detail).toContain("timed out");
  }, 15_000);

  it("a scanner that THROWS blocks rather than passing", async () => {
    const throwing: Scanners = {
      ...new MockScanners(),
      scanMalware: async () => {
        throw new Error("VirusTotal connection refused");
      },
      checkUrlReputation: new MockScanners().checkUrlReputation.bind(new MockScanners()),
      classifyContent: new MockScanners().classifyContent.bind(new MockScanners()),
      findDuplicates: new MockScanners().findDuplicates.bind(new MockScanners()),
    };
    const run = await runPipeline(baseInput, throwing);
    expect(run.verdict.decision).toBe("block");
  });
});
