import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeSplit } from "../../lib/money/split";
import { referralAmount } from "../../lib/money/referral";

/**
 * Guards against doc drift (the D5 class of error): every worked example
 * in the docs and skills is parsed FROM THE ACTUAL FILES and asserted
 * against computeSplit / referralAmount. If an example is reworded so the
 * regex no longer matches, the test fails loudly rather than passing empty.
 */

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("documented worked examples match the money code", () => {
  it("PRD §2.3 — the $5 example in cents", () => {
    const prd = read("docs/01-PRD.md");
    // Capture every "(N¢" in the §2.3 block, in order:
    // gross, processing, net, creator, platform.
    const block = prd.match(/Buyer pays[\s\S]{0,600}?Platform 25%[^\n]*/);
    expect(block, "PRD §2.3 worked-example block not found").toBeTruthy();
    const cents = [...block![0].matchAll(/\((\d+)¢/g)].map((m) => Number(m[1]));
    expect(cents, "expected 5 cent figures in PRD §2.3").toHaveLength(5);
    const [gross, processing, net, creator, platform] = cents as [number, number, number, number, number];
    const split = computeSplit(gross, processing);
    expect(split).toEqual({ net, creator, platform });
  });

  it("Application Flow §7 — Bob's $29 sale and Alice's referral", () => {
    const flow = read("docs/05-Application-Flow.md");
    const line = flow.match(
      /net = \$(\d+)\.(\d{2}) · Bob = \$(\d+)\.(\d{2})[^·]*· platform = \$(\d+)\.(\d{2})/
    );
    expect(line, "Application Flow §7 split line not found").toBeTruthy();
    const [, n1, n2, b1, b2, p1, p2] = line!;
    const net = Number(n1) * 100 + Number(n2);
    const bob = Number(b1) * 100 + Number(b2);
    const platform = Number(p1) * 100 + Number(p2);
    // $29 gross with $1.14 processing is the canonical example.
    const split = computeSplit(2900, 114);
    expect({ net, creator: bob, platform }).toEqual(split);

    const alice = flow.match(/Alice earns 5% OF PLATFORM REVENUE = \$(\d+)\.(\d{2})/);
    expect(alice, "Application Flow §7 referral line not found").toBeTruthy();
    const aliceCents = Number(alice![1]) * 100 + Number(alice![2]);
    expect(aliceCents).toBe(referralAmount(split.platform));
  });

  it("money-ledger skill — every worked-example table row", () => {
    const skill = read(".claude/skills/money-ledger/SKILL.md");
    const rows = [...skill.matchAll(/\|\s*\$[\d.]+ → (\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/g)];
    expect(rows.length, "expected 3 worked-example rows in the skill").toBe(3);
    for (const [, gross, processing, net, creator, platform] of rows) {
      expect(computeSplit(Number(gross), Number(processing))).toEqual({
        net: Number(net),
        creator: Number(creator),
        platform: Number(platform),
      });
    }
  });

  it("smoke-test fixture 06 — the DB order fixture uses the binding split", () => {
    const sql = read("db/tests/smoke_tests.sql");
    const m = sql.match(/2900, 114, (\d+), (\d+), (\d+), now\(\) \+ interval '14 days'/);
    expect(m, "smoke-test order fixture not found").toBeTruthy();
    const [, net, creator, platform] = m!;
    expect(computeSplit(2900, 114)).toEqual({
      net: Number(net),
      creator: Number(creator),
      platform: Number(platform),
    });
  });
});
