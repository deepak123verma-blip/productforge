import { describe, expect, it } from "vitest";
import { computeSplit } from "../../lib/money/split";

// Deterministic PRNG so a failure is reproducible from the logged seed.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s;
  };
}

const SEED = 0xf0f0f0;
const CASES = 10_000;

describe("computeSplit property test", () => {
  it(`holds creator + platform === net over ${CASES} random cases (seed ${SEED})`, () => {
    const next = lcg(SEED);
    for (let i = 0; i < CASES; i++) {
      const gross = 500 + (next() % (100_000 - 500 + 1));
      const processing = next() % (gross + 1);
      const { net, creator, platform } = computeSplit(gross, processing);

      const label = `case ${i}: gross=${gross} processing=${processing}`;
      expect(net, label).toBe(gross - processing);
      expect(creator + platform, label).toBe(net);
      expect(creator, label).toBeGreaterThanOrEqual(0);
      expect(platform, label).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(creator), label).toBe(true);
      expect(Number.isSafeInteger(platform), label).toBe(true);
      // Rounding must favour the platform: creator is the floor of 75%.
      expect(creator, label).toBeLessThanOrEqual(platform * 3);
    }
  });

  it("rejects floats, negatives, and processing > gross", () => {
    expect(() => computeSplit(500.5, 45)).toThrow(RangeError);
    expect(() => computeSplit(500, 45.1)).toThrow(RangeError);
    expect(() => computeSplit(-500, 0)).toThrow(RangeError);
    expect(() => computeSplit(500, 501)).toThrow(RangeError);
  });
});
