/**
 * Results → verdict. Pure, exhaustively tested.
 *   any fail            → block (product stays draft, reason shown)
 *   any flag, no fail   → publish, review_state stays pending, flagged for FULL review
 *   all pass            → publish, normal review tiering
 * A TIMEOUT IS A FAIL (TRD §5): never allowed through on a timeout.
 */

export type CheckResult = "pass" | "flag" | "fail";

export interface CheckOutcome {
  check: "integrity" | "malware" | "archive" | "url_reputation" | "prohibited_content" | "risk_claims" | "duplicate";
  result: CheckResult;
  detail: string;
}

export type Verdict =
  | { decision: "block"; reasons: string[] }
  | { decision: "publish_flagged"; flags: string[] }
  | { decision: "publish" };

export function decide(outcomes: readonly CheckOutcome[]): Verdict {
  const fails = outcomes.filter((o) => o.result === "fail");
  if (fails.length > 0) {
    return { decision: "block", reasons: fails.map((f) => `${f.check}: ${f.detail}`) };
  }
  const flags = outcomes.filter((o) => o.result === "flag");
  if (flags.length > 0) {
    return { decision: "publish_flagged", flags: flags.map((f) => `${f.check}: ${f.detail}`) };
  }
  return { decision: "publish" };
}
