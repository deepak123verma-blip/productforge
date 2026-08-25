import { CreatorShell } from "../../../components/creator/CreatorShell";
import { LinkActions } from "../../../components/creator/LinkActions";
import { requireCreator } from "../../../lib/auth/require";
import { ListRow } from "../../../components/primitives/ListRow";
import { Money } from "../../../components/primitives/Money";
import { Table } from "../../../components/primitives/Table";
import { getRepository } from "../../../lib/db/repositories";
import type { SourceRow } from "../../../lib/db/repositories";

function conv(bps: number | null): string {
  if (bps === null) return "—";
  const whole = Math.floor(bps / 100);
  const frac = Math.floor((bps % 100) / 10);
  return `${whole}.${frac}%`;
}

function rowTint(row: SourceRow, avgBps: number): string {
  if (row.conversionBps === null) return "";
  if (row.conversionBps >= avgBps * 2) return "bg-mint";
  if (row.conversionBps * 10 < avgBps * 3) return "bg-blush"; // below 0.3× the average
  return "";
}

function SourceTable({ rows, caption }: { rows: SourceRow[]; caption: string }) {
  const withConv = rows.filter((r) => r.conversionBps !== null);
  const avgBps =
    withConv.length === 0
      ? 0
      : Math.floor(withConv.reduce((s, r) => s + (r.conversionBps ?? 0), 0) / withConv.length);
  return (
    <Table caption={caption} headers={["Content", "Clicks", "Checkouts", "Sales", "Revenue", "Conv"]}>
      {rows.map((r) => (
        <tr key={r.source} className={`border-b border-hairline ${rowTint(r, avgBps)}`}>
          <td className="px-tight py-tight font-medium text-ink">{r.source}</td>
          <td className="px-tight py-tight">{r.visits === null ? "—" : r.visits.toLocaleString("en-US")}</td>
          <td className="px-tight py-tight">{r.checkouts === null ? "—" : r.checkouts.toLocaleString("en-US")}</td>
          <td className="px-tight py-tight">{r.sales}</td>
          <td className="px-tight py-tight"><Money cents={r.revenueCents} /></td>
          <td className="px-tight py-tight font-figures [font-variant-numeric:tabular-nums]">{conv(r.conversionBps)}</td>
        </tr>
      ))}
    </Table>
  );
}

export default async function TrafficPage() {
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const [links, bySource, byContent] = await Promise.all([
    repo.listLinks(me.id),
    repo.trafficBySource(me.id),
    repo.trafficByContent(me.id),
  ]);

  return (
    <CreatorShell title="Traffic" displayName={me.displayName}>
      <div className="flex flex-col gap-section">
        <section aria-label="Links" className="flex flex-col gap-gap">
          <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Links</h2>
          <div className="grid grid-cols-1 gap-tight min-[640px]:grid-cols-2">
            {links.map((l) => (
              <ListRow
                key={l.id}
                icon="🔗"
                primary={l.label}
                secondary={`${l.shortUrl} → ${l.destination}`}
                trailing={<LinkActions url={l.shortUrl} label={l.label} />}
              />
            ))}
          </div>
        </section>

        <section aria-label="Revenue by source" className="flex flex-col gap-gap">
          <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Revenue by source</h2>
          <SourceTable caption="Revenue by source" rows={bySource} />
        </section>

        <section aria-label="By content" className="flex flex-col gap-gap">
          <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">By content</h2>
          <SourceTable caption="Revenue by content" rows={byContent} />
          <p className="text-body-s text-ink-3">
            Green rows convert at twice your average or better; pink rows under a third of it. "Direct" is unattributed — never guessed.
          </p>
        </section>
      </div>
    </CreatorShell>
  );
}
