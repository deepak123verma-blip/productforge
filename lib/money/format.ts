import { type LedgerEntryDraft } from "./ledger";

/**
 * Cents → display strings (design spec §5.7). Formatting happens at the
 * edge, from integers — never store or compute money as floats.
 * Negatives use U+2212 (−), never a hyphen, never parentheses.
 */

const MINUS = "−";

export interface FormatOptions {
  /** Stat cards may drop cents at or above $1,000 for scanability. */
  dropCentsOver1000?: boolean;
}

export function formatCents(cents: number, opts: FormatOptions = {}): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatCents needs integer cents, got ${cents}`);
  }
  const negative = cents < 0;
  const abs = negative ? -cents : cents;
  const dollars = Math.floor(abs / 100); // int-div — whole-dollar part
  const rem = abs % 100;
  const grouped = dollars.toLocaleString("en-US");
  const dropCents = opts.dropCentsOver1000 === true && dollars >= 1000;
  const body = dropCents ? `$${grouped}` : `$${grouped}.${String(rem).padStart(2, "0")}`;
  return negative ? `${MINUS}${body}` : body;
}

/** Tables ALWAYS show two decimals and are never abbreviated. */
export function formatCentsTable(cents: number): string {
  return formatCents(cents);
}

/** Delta line: explicit sign, U+2212 for negative. */
export function formatDelta(cents: number): string {
  return cents < 0 ? formatCents(cents) : `+${formatCents(cents)}`;
}

export function balanceLabel(entries: readonly Pick<LedgerEntryDraft, "amountCents">[]): string {
  let sum = 0;
  for (const e of entries) sum += e.amountCents;
  return formatCents(sum);
}
