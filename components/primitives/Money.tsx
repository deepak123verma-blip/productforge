import { formatCents, formatDelta, type FormatOptions } from "../../lib/money/format";

/**
 * Money is ALWAYS Space Grotesk with tabular-nums; two decimals in tables;
 * U+2212 and --negative for negatives (design spec §5.7).
 */
export function Money({
  cents,
  delta = false,
  className = "",
  ...opts
}: { cents: number; delta?: boolean; className?: string } & FormatOptions) {
  const text = delta ? formatDelta(cents) : formatCents(cents, opts);
  const negative = cents < 0;
  return (
    <span
      className={`font-figures [font-variant-numeric:tabular-nums] ${negative ? "text-negative" : ""} ${className}`}
    >
      {text}
    </span>
  );
}
