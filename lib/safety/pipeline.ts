import { checkArchive, checkContent, checkDuplicate, checkIntegrity, checkMalware, checkUrl } from "./checks";
import { decide, type CheckOutcome, type Verdict } from "./decision";
import type { FileInput, Scanners } from "./scanners";

/**
 * Publish-time safety pipeline (TRD §5). Orchestration is pure logic
 * over the injected Scanners interface — no client imports here.
 *
 * Budget: 10s total, per-check timeouts. A TIMEOUT IS A BLOCK, NEVER A
 * PASS — the failure mode that matters. Above 30s the caller blocks
 * publish with a retry regardless.
 */

export interface PipelineInput {
  files: FileInput[];
  linkUrls: string[];
  title: string;
  description: string;
  extractedText: string;
  coverKey: string | null;
}

export const TIMEOUTS_MS = {
  malware: 5000,
  url_reputation: 2000,
  content: 4000,
  duplicate: 3000,
  total: 10_000,
} as const;

function timeoutOutcome(check: CheckOutcome["check"], ms: number): CheckOutcome {
  return { check, result: "fail", detail: `timed out after ${ms}ms — a timeout blocks, never passes` };
}

/** Race a check against its timeout; on ANY rejection or timeout → fail outcome. */
async function bounded(
  check: CheckOutcome["check"],
  ms: number,
  work: Promise<CheckOutcome | CheckOutcome[]>
): Promise<CheckOutcome[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CheckOutcome[]>((resolve) => {
    timer = setTimeout(() => resolve([timeoutOutcome(check, ms)]), ms);
  });
  try {
    const result = await Promise.race([work.then((r) => (Array.isArray(r) ? r : [r])), timeout]);
    return result;
  } catch (e) {
    return [{ check, result: "fail", detail: `check errored: ${e instanceof Error ? e.message : String(e)}` }];
  } finally {
    clearTimeout(timer);
  }
}

export interface PipelineRun {
  outcomes: CheckOutcome[];
  verdict: Verdict;
  elapsedMs: number;
}

export async function runPipeline(
  input: PipelineInput,
  scanners: Scanners,
  nowMs: () => number = () => performance.now()
): Promise<PipelineRun> {
  const started = nowMs();
  const outcomes: CheckOutcome[] = [];

  // Synchronous, cheap, always first: integrity + archive per file.
  for (const f of input.files) {
    outcomes.push(checkIntegrity(f));
    outcomes.push(checkArchive(f));
  }

  // Bounded async checks, in parallel.
  const work: Promise<CheckOutcome[]>[] = [
    ...input.files.map((f) => bounded("malware", TIMEOUTS_MS.malware, checkMalware(scanners, f))),
    ...input.linkUrls.map((u) => bounded("url_reputation", TIMEOUTS_MS.url_reputation, checkUrl(scanners, u))),
    bounded(
      "prohibited_content",
      TIMEOUTS_MS.content,
      checkContent(scanners, `${input.title}\n${input.description}\n${input.extractedText}`)
    ),
    bounded("duplicate", TIMEOUTS_MS.duplicate, checkDuplicate(scanners, { coverKey: input.coverKey, text: input.extractedText })),
  ];

  const totalTimer = new Promise<"total_timeout">((resolve) => {
    setTimeout(() => resolve("total_timeout"), TIMEOUTS_MS.total);
  });
  const settled = await Promise.race([Promise.all(work), totalTimer]);

  if (settled === "total_timeout") {
    outcomes.push({ check: "malware", result: "fail", detail: `pipeline exceeded the ${TIMEOUTS_MS.total}ms budget — publish blocked with retry` });
  } else {
    for (const group of settled) outcomes.push(...group);
  }

  return { outcomes, verdict: decide(outcomes), elapsedMs: Math.round(nowMs() - started) };
}
