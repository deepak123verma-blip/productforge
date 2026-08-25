import { CreatorShell } from "../../../components/creator/CreatorShell";
import { LinkActions } from "../../../components/creator/LinkActions";
import { requireCreator } from "../../../lib/auth/require";
import { Money } from "../../../components/primitives/Money";
import { StatCard } from "../../../components/primitives/StatCard";
import { Table } from "../../../components/primitives/Table";
import { getRepository } from "../../../lib/db/repositories";

export default async function ReferralsPage() {
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const r = await repo.referralSummary(me.id);

  return (
    <CreatorShell title="Referrals" displayName={me.displayName}>
      <div className="flex flex-col gap-section">
        <section aria-label="Your link" className="flex flex-wrap items-center gap-gap rounded-card bg-sky p-gap">
          <div className="min-w-0">
            <p className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">Your link</p>
            <p className="truncate font-figures text-display-s text-ink [font-variant-numeric:tabular-nums]">{r.link}</p>
          </div>
          <span className="ml-auto">
            <LinkActions url={r.link} label="Your referral link" />
          </span>
        </section>

        <div className="grid grid-cols-1 gap-gap min-[640px]:grid-cols-2 min-[1280px]:grid-cols-4">
          <StatCard label="Referral earnings" cents={r.totalEarnedCents} pastel="sky" />
          <StatCard label="Referred creators" count={r.referredCount} pastel="sky" />
          <StatCard label="Active creators" count={r.activeCount} pastel="sky" />
          <StatCard label="This month" cents={r.thisMonthCents} pastel="sky" />
        </div>

        <section aria-label="Referred creators" className="flex flex-col gap-gap">
          <Table
            caption="Referred creators"
            headers={["Creator", "Joined", "Their sales", "Platform revenue", "Your 5%", "Months left"]}
          >
            {r.rows.map((row) => (
              <tr key={row.creator} className="border-b border-hairline">
                <td className="px-tight py-tight font-medium text-ink">{row.creator}</td>
                <td className="whitespace-nowrap px-tight py-tight">{row.joinedLabel}</td>
                <td className="px-tight py-tight"><Money cents={row.theirSalesCents} /></td>
                <td className="px-tight py-tight"><Money cents={row.platformRevenueCents} /></td>
                <td className="px-tight py-tight font-medium"><Money cents={row.yourCutCents} /></td>
                <td className="px-tight py-tight">{row.monthsRemaining} of 12</td>
              </tr>
            ))}
          </Table>
        </section>

        <p className="max-w-lg text-body text-ink-2">
          5% of what ProductForge earns from creators you invite, for 12 months. Paid with your normal weekly payout.
          One level only.
        </p>
      </div>
    </CreatorShell>
  );
}
