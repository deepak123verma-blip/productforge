#!/usr/bin/env node
/**
 * WCAG AA contrast check over the token matrix in app/globals.css.
 *
 * The design system permits specific text-on-fill pairs (spec §8):
 *   - --ink and --ink-2 on every fill
 *   - --ink-3 on surface / canvas / surface-sunk ONLY (it fails on pastels)
 *   - white (--surface) on --ink (buttons, active rail item)
 *   - --positive / --negative / --warning on --surface
 * Every permitted pair must meet AA (4.5:1 normal text).
 * The check also asserts the KNOWN-BAD pairs (--ink-3 on each pastel)
 * really do fail — if a token edit made them pass, the rule in the spec
 * and CLAUDE.md would silently stop being true.
 */
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const tokens = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  tokens[m[1]] = m[2];
}

function lum(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const pastels = ["mint", "butter", "blush", "lilac", "sky"];
const surfaces = ["surface", "canvas", "surface-sunk"];
const AA = 4.5;

const mustPass = [];
for (const fill of [...surfaces, ...pastels]) {
  mustPass.push(["ink", fill]);
  mustPass.push(["ink-2", fill]);
}
// Ruling A1: --ink-3 is caption text on --surface and --surface-sunk ONLY,
// and must pass AA there. It stays banned on pastels and canvas permanently.
mustPass.push(["ink-3", "surface"]);
mustPass.push(["ink-3", "surface-sunk"]);
mustPass.push(["surface", "ink"]);
for (const t of ["positive", "negative"]) mustPass.push([t, "surface"]);
// --warning is permitted at large/bold sizes only (AA large-text 3:1) —
// see docs/OPEN-QUESTIONS.md #3.
const mustPassLarge = [["warning", "surface"]];

const mustFail = [...pastels, "canvas"].map((p) => ["ink-3", p]);

let failed = false;
for (const [text, fill] of mustPass) {
  const r = ratio(tokens[text], tokens[fill]);
  const ok = r >= AA;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${text} on ${fill}  ${r.toFixed(2)}:1`);
}
for (const [text, fill] of mustPassLarge) {
  const r = ratio(tokens[text], tokens[fill]);
  const ok = r >= 3;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${text} on ${fill} (large text)  ${r.toFixed(2)}:1`);
}
for (const [text, fill] of mustFail) {
  const r = ratio(tokens[text], tokens[fill]);
  const ok = r < AA; // expected to fail AA — that's why the pair is banned
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${text} on ${fill} is correctly banned (${r.toFixed(2)}:1 < ${AA})`);
}

process.exit(failed ? 1 : 0);
