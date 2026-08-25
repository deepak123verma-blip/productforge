import { CreatorShell } from "../../../components/creator/CreatorShell";
import { ArrowChip } from "../../../components/primitives/ArrowChip";
import { ListRow } from "../../../components/primitives/ListRow";
import { Money } from "../../../components/primitives/Money";
import { PayoutCalendar } from "../../../components/primitives/PayoutCalendar";
import { ProgressRow } from "../../../components/primitives/ProgressRow";
import { StatCard } from "../../../components/primitives/StatCard";
import { pastelBg } from "../../../components/primitives/tokens";
import { getRepository } from "../../../lib/db/repositories";
import { formatCents } from "../../../lib/money/format";
import { requireCreator } from "../../../lib/auth/require";

export default async function HomePage() {
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const [attention, stats, products, payout, activity] = await Promise.all([
    repo.attention(me.id),
    repo.monthStats(me.id),
    repo.listProducts(me.id),
    repo.payoutSummary(me.id),
    repo.recentActivity(me.id),
  ]);
  const liveProducts = products.filter((p) => p.status === "live");
  const bundleCandidates = liveProducts.filter((p) => p.kind === "single");
  const individualTotal = bundleCandidates.reduce((s, p) => s + p.priceCents, 0);
  const showBundlePrompt = liveProducts.length >= 3 && !liveProducts.some((p) => p.kind === "bundle");

  return (
    <CreatorShell title="Welcome back 👋" displayName={me.displayName}>
      <div className="grid grid-cols-1 gap-loose min-[900px]:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-section">
          {attention.length > 0 && (
            <section aria-label={`Needs your attention (${attention.length})`} className="flex flex-col gap-gap">
              <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">
                Needs your attention ({attention.length})
              </h2>
              {attention.map((a) => (
                <article key={a.id} className={`relative flex min-h-feature-card flex-col rounded-card p-gap ${pastelBg[a.tone]}`}>
                  <h3 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">{a.title}</h3>
                  <p className="mt-1 text-body-s text-ink-2">{a.line}</p>
                  <div className="mt-auto flex justify-end">
                    <ArrowChip href={a.actionHref} label={a.actionLabel} />
                  </div>
                </article>
              ))}
            </section>
          )}

          <section aria-label="This month" className="flex flex-col gap-gap">
            <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">This month</h2>
            <div className="grid grid-cols-1 gap-gap min-[640px]:grid-cols-3">
              <StatCard label="Earned" cents={stats.earnedCents} pastel="mint" href="/payouts" />
              <StatCard label="Sales" count={stats.sales} pastel="butter" href="/sales" />
              <StatCard label="Buyers" count={stats.buyers} pastel="blush" href="/customers" />
            </div>
          </section>

          <section aria-label="Your products" className="flex flex-col gap-gap">
            <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Your products</h2>
            {liveProducts.map((p) => (
              <ProgressRow
                key={p.id}
                eyebrow={formatMix(p)}
                title={p.title}
                caption={`${p.lifetimeSales} sales · ${formatCents(p.lifetimeRevenueCents)} lifetime`}
                progressPct={p.monthRevenueShare}
                href={`/products/${p.id}`}
                icon={p.coverEmoji}
              />
            ))}
          </section>

          {showBundlePrompt && (
            <section aria-label="Bundle prompt">
              <article className="relative rounded-card bg-butter p-gap">
                <h3 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">
                  Your products would make a strong bundle
                </h3>
                <p className="mt-1 text-body-s text-ink-2">
                  Bought separately they cost <Money cents={individualTotal} className="font-medium" /> — a bundle at{" "}
                  <Money cents={suggestedBundlePrice(individualTotal)} className="font-medium" /> raises your average order.
                </p>
                <div className="mt-tight flex justify-end">
                  <ArrowChip href="/products" label="Build a bundle" />
                </div>
              </article>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-section">
          <PayoutCalendar
            monthLabel={payout.monthLabel}
            days={payout.calendar}
            nextPayoutCents={payout.availableCents}
            nextPayoutDateLabel={payout.nextPayoutDateLabel}
            clearingCents={payout.clearingCents}
          />
          <section aria-label="Recent activity" className="flex flex-col gap-tight">
            <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Recent activity</h2>
            {activity.map((a) => (
              <ListRow
                key={a.id}
                icon={a.icon}
                primary={a.primary}
                secondary={a.secondary}
                trailing={a.amountCents !== undefined ? <Money cents={a.amountCents} className="text-body-s" /> : undefined}
              />
            ))}
          </section>
        </aside>
      </div>
    </CreatorShell>
  );
}

function formatMix(p: { assets: { format: string }[] }): string {
  const counts = new Map<string, number>();
  for (const a of p.assets) counts.set(a.format, (counts.get(a.format) ?? 0) + 1);
  return [...counts.entries()].map(([f, n]) => `${n} ${f.toUpperCase()}`).join(" · ");
}

function suggestedBundlePrice(individualTotalCents: number): number {
  // Suggest ~70% of the individual total, floored to a clean 100¢ boundary.
  const seventyPct = Math.floor((individualTotalCents * 7) / 10); // int-div
  return Math.max(500, Math.floor(seventyPct / 100) * 100); // int-div
}
