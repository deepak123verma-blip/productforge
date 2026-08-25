import { ArrowChip } from "./ArrowChip";
import { pastelBg, type Pastel } from "./tokens";

/**
 * Progress row — full-width pastel; icon circle + eyebrow, caption,
 * display-s title, 4px progress bar in --ink on 12% ink track.
 */
export function ProgressRow({
  eyebrow,
  title,
  caption,
  progressPct,
  pastel = "butter",
  href,
  icon = "📦",
}: {
  eyebrow: string;
  title: string;
  caption: string;
  progressPct: number; // 0..100, integer
  pastel?: Pastel;
  href: string;
  icon?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
  return (
    <article className={`relative rounded-card p-gap ${pastelBg[pastel]}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-tight">
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-chip bg-surface">
            {icon}
          </span>
          <div>
            <p className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">{eyebrow}</p>
            <h3 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">{title}</h3>
          </div>
        </div>
        <ArrowChip href={href} label={`Open ${title}`} />
      </div>
      <p className="mt-tight text-body-s text-ink-2">{caption}</p>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} — ${pct}% of this month's revenue`}
        className="mt-tight h-1 w-full rounded-chip bg-ink-12"
      >
        <div className="h-1 rounded-chip bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </article>
  );
}
