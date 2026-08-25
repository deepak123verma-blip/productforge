import { describe, expect, it } from "vitest";
import { computeSplit } from "../../lib/money/split";
import { referralAmount } from "../../lib/money/referral";
import { formatCents, formatDelta } from "../../lib/money/format";

describe("golden cases — PRD §2.3 (corrected per ruling A3)", () => {
  it("$5 sale: 500 gross, 45 processing → 455 / 341 / 114", () => {
    expect(computeSplit(500, 45)).toEqual({ net: 455, creator: 341, platform: 114 });
  });

  it("$29 sale: 2900 gross, 114 processing → 2786 / 2089 / 697", () => {
    // floor(2786 × 0.75) = 2089 — rounding favours the platform.
    expect(computeSplit(2900, 114)).toEqual({ net: 2786, creator: 2089, platform: 697 });
  });

  it("$79 sale: 7900 gross, 259 processing → 7641 / 5730 / 1911", () => {
    expect(computeSplit(7900, 259)).toEqual({ net: 7641, creator: 5730, platform: 1911 });
  });

  it("referral is 5% of PLATFORM revenue, floored", () => {
    expect(referralAmount(114)).toBe(5); // $5 sale → 5¢
    expect(referralAmount(697)).toBe(34); // $29 sale
    expect(referralAmount(25_000)).toBe(1250); // PRD §8.1: $1,000 seller → $12.50
  });
});

describe("money formatting — design spec §5.7", () => {
  it("two decimals, grouped, never abbreviated", () => {
    expect(formatCents(124_000)).toBe("$1,240.00");
    expect(formatCents(5)).toBe("$0.05");
  });
  it("U+2212 for negatives, never a hyphen", () => {
    expect(formatCents(-500)).toBe("−$5.00");
    expect(formatDelta(-500)).toBe("−$5.00");
    expect(formatDelta(500)).toBe("+$5.00");
  });
  it("stat cards may drop cents at $1,000+", () => {
    expect(formatCents(482_000, { dropCentsOver1000: true })).toBe("$4,820");
    expect(formatCents(41_260, { dropCentsOver1000: true })).toBe("$412.60");
  });
});
