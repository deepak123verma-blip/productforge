#!/usr/bin/env node
/**
 * Regex-based float guard for lib/money/** (wired into `pnpm lint` and CI).
 * A clean AST rule for "division where either operand isn't provably an
 * integer" is impractical, so this bans the dangerous constructs outright:
 *   - parseFloat / Number.parseFloat / toFixed on computed money
 *   - the `/` division operator (integer division must be written as
 *     Math.floor(a / b) on a single allowlisted helper line tagged
 *     `// int-div` after review)
 *   - float literals (e.g. 0.75 outside the two blessed constants)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "lib", "money");
const violations = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // lib/money may be empty pre-Phase 3
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(e)) checkFile(p);
  }
}

const RULES = [
  { re: /\bparseFloat\s*\(/, msg: "parseFloat is banned in money code" },
  { re: /Number\.parseFloat\s*\(/, msg: "Number.parseFloat is banned in money code" },
  { re: /\.toFixed\s*\(/, msg: "toFixed implies float maths; format from integer cents instead" },
  { re: /(?<![*/])\/(?![/*=])/, msg: "division in money code — write Math.floor(a / b) on a line tagged `// int-div`", allowTag: "// int-div" },
  { re: /(?<![\w.])\d+\.\d+(?![\w])/, msg: "float literal in money code", allowTag: "// ratio" },
];

function checkFile(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trimStart();
    // Skip comment-only lines (block-comment bodies and line comments).
    if (trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("//")) return;
    const noComment = line.split("//")[0] ?? ""; // ignore trailing line comments when matching
    // Blank out string literals so paths like "./split" don't read as division.
    const code = noComment.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
    for (const rule of RULES) {
      if (!rule.re.test(code)) continue;
      if (rule.allowTag && line.includes(rule.allowTag)) continue;
      violations.push(`${path}:${i + 1}  ${rule.msg}\n    ${line.trim()}`);
    }
  });
}

walk(ROOT);

if (violations.length) {
  console.error("Money float check FAILED:\n\n" + violations.join("\n\n"));
  process.exit(1);
}
console.log("Money float check passed (lib/money is clean or empty).");
