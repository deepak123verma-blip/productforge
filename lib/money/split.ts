/**
 * The split. CLAUDE.md money rules 4–5.
 * All amounts are integer cents. Rounding favours the platform so
 * creator + platform === net holds exactly (DB CHECK `split_balances`
 * enforces the same and rejects drift — this must agree with it).
 */

export interface Split {
  net: number;
  creator: number;
  platform: number;
}

export function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be integer cents, got ${value}`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative, got ${value}`);
  }
}

export function computeSplit(grossCents: number, processingCents: number): Split {
  assertCents(grossCents, "grossCents");
  assertCents(processingCents, "processingCents");
  if (processingCents > grossCents) {
    throw new RangeError(
      `processingCents (${processingCents}) exceeds grossCents (${grossCents})`
    );
  }
  const net = grossCents - processingCents;
  const creator = Math.floor(net * 0.75); // ratio — the binding 75% creator share
  const platform = net - creator; // never computed independently
  return { net, creator, platform };
}
