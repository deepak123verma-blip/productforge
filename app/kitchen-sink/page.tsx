import { ArrowChip } from "../../components/primitives/ArrowChip";
import { AssetRow } from "../../components/primitives/AssetRow";
import { AvatarStack } from "../../components/primitives/AvatarStack";
import { Button } from "../../components/primitives/Button";
import { EmptyState } from "../../components/primitives/EmptyState";
import { Field } from "../../components/primitives/Field";
import { IconRail } from "../../components/primitives/IconRail";
import { ListRow } from "../../components/primitives/ListRow";
import { Money } from "../../components/primitives/Money";
import { Panel } from "../../components/primitives/Panel";
import { PayoutCalendar } from "../../components/primitives/PayoutCalendar";
import { ProductCard } from "../../components/primitives/ProductCard";
import { ProgressRow } from "../../components/primitives/ProgressRow";
import { Skeleton, SkeletonCard } from "../../components/primitives/Skeleton";
import { StatCard } from "../../components/primitives/StatCard";
import { StatusChip } from "../../components/primitives/StatusChip";
import { Table } from "../../components/primitives/Table";
import { Toast } from "../../components/primitives/Toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-gap">
      <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

const calendarDays = Array.from({ length: 35 }, (_, i) => {
  const day = i < 3 ? 29 + i : i - 2;
  return {
    day,
    outsideMonth: i < 3 || i >= 33,
    isPayoutDay: i === 9,
    hasSales: [5, 6, 12, 14, 19].includes(i),
  };
});

function Sink() {
  return (
    <div className="flex flex-col gap-section">
      <Section title="Stat cards — all pastels, delta, navigable vs terminal">
        <div className="grid grid-cols-1 gap-gap min-[640px]:grid-cols-3">
          <StatCard label="Earned this month" cents={41_260} pastel="mint" deltaCents={8_820} href="/payouts" />
          <StatCard label="Sales" count={31} pastel="butter" href="/sales" />
          <StatCard label="Buyers" count={28} pastel="blush" />
          <StatCard label="Traffic" count={2140} pastel="lilac" href="/traffic" />
          <StatCard label="Referral earnings" cents={1250} pastel="sky" deltaCents={-35} href="/referrals" />
          <SkeletonCard />
        </div>
      </Section>

      <Section title="Product cards — every status">
        <div className="grid grid-cols-1 gap-gap min-[640px]:grid-cols-2 min-[900px]:grid-cols-4">
          <ProductCard title="30-Day Growth Kit" status="live" assetCount={5} sales={82} href="#" />
          <ProductCard title="Reel Hooks Pack" status="under_review" assetCount={2} sales={0} href="#" coverEmoji="🎬" />
          <ProductCard title="Draft Planner" status="draft" assetCount={1} sales={0} href="#" coverEmoji="🗓️" />
          <ProductCard title="Restricted Item" status="restricted" assetCount={3} sales={12} href="#" coverEmoji="⛔" />
        </div>
      </Section>

      <Section title="Status chips">
        <div className="flex flex-wrap gap-tight">
          <StatusChip status="draft" />
          <StatusChip status="live" />
          <StatusChip status="under_review" />
          <StatusChip status="restricted" />
        </div>
      </Section>

      <Section title="Asset rows — every format tile, editable + read-only">
        <div className="flex flex-col gap-tight">
          <AssetRow title="30-Day Planner" format="pdf" meta="2.4 MB" editable />
          <AssetRow title="Content Calendar" format="xlsx" meta="180 KB" editable />
          <AssetRow title="Template Bundle" format="zip" meta="24 MB" editable />
          <AssetRow title="Cover Art" format="img" meta="1.1 MB" />
          <AssetRow title="Canva Template Pack" format="link" meta="canva.com" />
        </div>
      </Section>

      <Section title="Progress row">
        <ProgressRow
          eyebrow="4 PDFs · 1 link"
          title="30-Day Growth Kit"
          caption="82 sales · $2,378.00 lifetime"
          progressPct={64}
          href="#"
        />
      </Section>

      <Section title="List rows & avatar stack">
        <div className="flex flex-col gap-tight">
          <ListRow icon="💸" primary="Sale — 30-Day Growth Kit" secondary="2 minutes ago" trailing={<Money cents={2900} className="text-body-s" />} />
          <ListRow icon="↩️" primary="Refund — Reel Hooks Pack" secondary="Yesterday" trailing={<Money cents={-900} className="text-body-s" />} />
          <AvatarStack names={["Maya", "Noah", "Rex", "Ana", "Kai", "Ivy"]} />
        </div>
      </Section>

      <Section title="Payout calendar">
        <div className="max-w-sm">
          <PayoutCalendar
            monthLabel="November"
            days={calendarDays}
            nextPayoutCents={41_260}
            nextPayoutDateLabel="Mon 3 Nov"
            clearingCents={8_820}
          />
        </div>
      </Section>

      <Section title="Buttons & fields — default, disabled, error">
        <div className="flex flex-wrap items-end gap-gap">
          <Button>Start selling</Button>
          <Button variant="secondary">Cancel</Button>
          <Button disabled>Publishing…</Button>
        </div>
        <div className="grid max-w-lg grid-cols-1 gap-gap min-[640px]:grid-cols-2">
          <Field label="Title" placeholder="30-Day Growth Kit" hint="Shown on your storefront" />
          <Field label="Price" defaultValue="4" error="The minimum price is $5.00. Raise the price to publish." />
          <Field label="Handle" defaultValue="maya" disabled />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="No products yet"
          line="Upload a file or make something new — either takes about two minutes."
          actionLabel="Create product"
          actionHref="/products"
        />
      </Section>

      <Section title="Skeletons (loading) & toasts">
        <div className="flex max-w-sm flex-col gap-tight">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex flex-wrap gap-tight">
          <Toast message="Published" />
          <Toast tone="error" message="This file didn't pass our security scan. Try re-exporting it from the original app, or upload a different file." />
        </div>
      </Section>

      <Section title="Money — tables two decimals, U+2212 negatives, stat abbreviation">
        <div className="flex flex-wrap gap-gap text-body">
          <Money cents={124_000} />
          <Money cents={-500} />
          <Money cents={482_000} dropCentsOver1000 />
          <Money cents={500} delta />
        </div>
      </Section>

      <Section title="Table">
        <Table headers={["Date", "Product", "Gross", "Your earnings", "Status"]} caption="Recent sales">
          <tr className="border-b border-hairline">
            <td className="px-tight py-tight">24 Aug</td>
            <td className="px-tight py-tight">30-Day Growth Kit</td>
            <td className="px-tight py-tight"><Money cents={2900} /></td>
            <td className="px-tight py-tight"><Money cents={2089} /></td>
            <td className="px-tight py-tight"><StatusChip status="live" /></td>
          </tr>
          <tr className="bg-blush">
            <td className="px-tight py-tight">23 Aug</td>
            <td className="px-tight py-tight">Reel Hooks Pack</td>
            <td className="px-tight py-tight"><Money cents={900} /></td>
            <td className="px-tight py-tight"><Money cents={-900} /></td>
            <td className="px-tight py-tight">Refunded</td>
          </tr>
        </Table>
      </Section>

      <Section title="Arrow chip — hover to see the only motion it has">
        <div className="flex items-center gap-gap rounded-card bg-mint p-gap">
          <span className="text-body text-ink-2">Navigable card affordance →</span>
          <ArrowChip href="#" label="Example" />
        </div>
      </Section>
    </div>
  );
}

export default function KitchenSinkPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-section p-tight min-[640px]:p-loose">
      <div className="flex w-full max-w-panel items-start gap-gap">
        <IconRail activeHref="/kitchen-sink" />
        <Panel>
          <h1 className="mb-gap font-display text-display-l font-bold tracking-[-0.02em] text-ink">
            Kitchen sink
          </h1>
          <nav aria-label="All routes" className="mb-section flex flex-wrap gap-1 text-body-s">
            {[
              ["/", "Landing"], ["/home", "Home"], ["/products", "Products"], ["/products/new", "Create"],
              ["/sales", "Sales"], ["/traffic", "Traffic"], ["/customers", "Customers"], ["/payouts", "Payouts"],
              ["/referrals", "Referrals"], ["/settings", "Settings"], ["/@maya", "@maya"],
              ["/@maya/30-day-growth-kit", "Product page"], ["/access", "/access"],
              ["/admin/review", "Admin review"], ["/kitchen-sink/stubs", "Stub registry"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-chip bg-surface-sunk px-tight py-1 text-ink">
                {label}
              </a>
            ))}
          </nav>
          <Sink />
        </Panel>
      </div>

      <div className="w-full max-w-panel">
        <h2 className="mb-gap font-display text-display-m font-bold tracking-[-0.02em] text-ink">
          375px viewport frame
        </h2>
        <div className="w-mobile-frame overflow-y-auto rounded-panel-sm bg-surface p-tight shadow-panel">
          <Sink />
        </div>
      </div>
    </main>
  );
}
