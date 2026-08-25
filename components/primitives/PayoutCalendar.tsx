import { Money } from "./Money";

/**
 * 7-col grid, 32px circular cells. Payout Monday = --ink fill, white figure.
 * Days with sales = --surface-sunk. Outside month = --ink-3 (permitted:
 * this sits on --surface). Below: next payout in display-s, clearing in caption.
 */
export function PayoutCalendar({
  monthLabel,
  days,
  nextPayoutCents,
  nextPayoutDateLabel,
  clearingCents,
}: {
  monthLabel: string;
  days: { day: number; outsideMonth: boolean; isPayoutDay: boolean; hasSales: boolean }[];
  nextPayoutCents: number;
  nextPayoutDateLabel: string;
  clearingCents: number;
}) {
  return (
    <div className="rounded-card bg-surface p-gap">
      <p className="mb-tight text-caption font-semibold uppercase tracking-[0.04em] text-ink-2">{monthLabel}</p>
      <div role="grid" aria-label={`Payout calendar, ${monthLabel}`} className="grid grid-cols-7 gap-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} aria-hidden="true" className="flex h-8 w-8 items-center justify-center text-caption text-ink-3">
            {d}
          </span>
        ))}
        {days.map((d, i) => (
          <span
            key={i}
            role="gridcell"
            aria-label={`${d.day}${d.isPayoutDay ? ", payout day" : d.hasSales ? ", sales" : ""}`}
            className={`flex h-8 w-8 items-center justify-center rounded-chip font-figures text-body-s [font-variant-numeric:tabular-nums] ${
              d.isPayoutDay
                ? "bg-ink text-surface"
                : d.hasSales
                  ? "bg-surface-sunk text-ink"
                  : d.outsideMonth
                    ? "text-ink-3"
                    : "text-ink"
            }`}
          >
            {d.day}
          </span>
        ))}
      </div>
      <p className="mt-gap font-display text-display-s font-bold tracking-[-0.02em] text-ink">
        Next payout — <Money cents={nextPayoutCents} /> on {nextPayoutDateLabel}
      </p>
      <p className="text-caption text-ink-3">
        <Money cents={clearingCents} /> still clearing
      </p>
    </div>
  );
}
