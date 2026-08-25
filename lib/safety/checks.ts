import type { CheckOutcome } from "./decision";
import type { FileInput, Scanners } from "./scanners";

/**
 * The individual checks (TRD §5). Each returns a CheckOutcome; the
 * pipeline owns timeouts. Blocking checks fail; advisory checks flag.
 */

export function checkIntegrity(file: FileInput): CheckOutcome {
  if (file.sniffedFormat !== file.declaredFormat) {
    return { check: "integrity", result: "fail", detail: `declared ${file.declaredFormat} but file is ${file.sniffedFormat}` };
  }
  return { check: "integrity", result: "pass", detail: "type matches magic bytes" };
}

export function checkArchive(file: FileInput): CheckOutcome {
  if (!file.isArchive) return { check: "archive", result: "pass", detail: "not an archive" };
  if ((file.archiveDepth ?? 0) > 3) {
    return { check: "archive", result: "fail", detail: `nesting depth ${file.archiveDepth} exceeds 3` };
  }
  if ((file.archiveExpansionRatio ?? 0) > 100) {
    return { check: "archive", result: "fail", detail: `expansion ratio ${file.archiveExpansionRatio}× exceeds 100× (zip bomb)` };
  }
  return { check: "archive", result: "pass", detail: "archive within limits" };
}

export async function checkMalware(scanners: Scanners, file: FileInput): Promise<CheckOutcome> {
  const r = await scanners.scanMalware(file);
  return r.clean
    ? { check: "malware", result: "pass", detail: "clean" }
    : { check: "malware", result: "fail", detail: r.threat ?? "malware detected" };
}

export async function checkUrl(scanners: Scanners, url: string): Promise<CheckOutcome> {
  const r = await scanners.checkUrlReputation(url);
  return r.safe
    ? { check: "url_reputation", result: "pass", detail: "reputation clean" }
    : { check: "url_reputation", result: "fail", detail: r.category ?? "flagged URL" };
}

export async function checkContent(scanners: Scanners, text: string): Promise<CheckOutcome[]> {
  const r = await scanners.classifyContent(text);
  return [
    r.prohibited
      ? { check: "prohibited_content", result: "fail", detail: r.prohibitedReason ?? "prohibited" }
      : { check: "prohibited_content", result: "pass", detail: "classifier clean" },
    r.riskClaims.length > 0
      ? { check: "risk_claims", result: "flag", detail: r.riskClaims.join(", ") }
      : { check: "risk_claims", result: "pass", detail: "no risk claims" },
  ];
}

export async function checkDuplicate(
  scanners: Scanners,
  input: { coverKey: string | null; text: string }
): Promise<CheckOutcome> {
  const r = await scanners.findDuplicates(input);
  return r.similarity >= 0.8
    ? { check: "duplicate", result: "flag", detail: `${Math.round(r.similarity * 100)}% match with ${r.matchedProductId}` }
    : { check: "duplicate", result: "pass", detail: "no close match" };
}
