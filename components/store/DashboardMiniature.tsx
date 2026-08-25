import { PayoutCalendar } from "../primitives/PayoutCalendar";
import { ProgressRow } from "../primitives/ProgressRow";
import { StatCard } from "../primitives/StatCard";

/**
 * The hero's live dashboard miniature — REAL components at 0.6 scale,
 * never a screenshot (PRD §4.1). Numbers mirror the fixtures so the
 * landing page and the demo dashboard agree. Below 900px the landing
 * shows the single stacked StatCard variant instead.
 */

const days = Array.from({ length: 35 }, (_, i) => ({
  day: i < 5 ? 27 + i : i - 4,
  outsideMonth: i < 5,
  isPayoutDay: i === 6,
  hasSales: i >= 5 && i % 3 !== 0,
}));

function MiniatureContent() {
  return (
    <div className="flex w-full flex-col gap-gap rounded-panel-sm bg-surface p-gap shadow-panel">
      <div className="grid grid-cols-2 gap-tight">
        <StatCard label="Earned this month" cents={41_260} pastel="mint" deltaCents={8_820} />
        <StatCard label="Sales" count={137} pastel="butter" />
      </div>
      <ProgressRow
        eyebrow="4 PDF · 1 LINK"
        title="30-Day Instagram Growth Kit"
        caption="82 sales · $2,378.00 lifetime"
        progressPct={64}
        href="#start"
        icon="📈"
      />
      <PayoutCalendar
        monthLabel="August"
        days={days}
        nextPayoutCents={41_260}
        nextPayoutDateLabel="Mon 31 Aug"
        clearingCents={8_820}
      />
    </div>
  );
}

export function DashboardMiniature() {
  return (
    <>
      {/* ≥900px: the full miniature at 0.6 scale */}
      <div aria-hidden="true" className="hidden h-[--miniature-h] w-[--miniature-w] overflow-hidden min-[900px]:block">
        <div className="origin-top-left scale-[0.6] w-[--miniature-inner-w]">
          <MiniatureContent />
        </div>
      </div>
      {/* <900px: one stacked stat card (spec §6.1) */}
      <div aria-hidden="true" className="w-full min-[900px]:hidden">
        <StatCard label="Earned this month" cents={41_260} pastel="mint" deltaCents={8_820} />
      </div>
    </>
  );
}
