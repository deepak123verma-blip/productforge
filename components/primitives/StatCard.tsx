import { ArrowChip } from "./ArrowChip";
import { Money } from "./Money";
import { pastelBg, type Pastel } from "./tokens";

/**
 * Stat card — 132px, pastel fill, caption label, stat figure, optional
 * arrow chip (navigable cards only; absence carries information).
 * Text on pastel is --ink / --ink-2 only (ruling A1).
 */
export function StatCard({
  label,
  cents,
  count,
  pastel,
  deltaCents,
  href,
  hrefLabel,
}: {
  label: string;
  cents?: number;
  count?: number;
  pastel: Pastel;
  deltaCents?: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <article className={`relative flex h-stat-card flex-col justify-between rounded-card p-gap ${pastelBg[pastel]}`}>
      <p className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          {cents !== undefined ? (
            <Money cents={cents} dropCentsOver1000 className="text-stat font-bold leading-stat text-ink" />
          ) : (
            <span className="font-figures text-stat font-bold leading-stat text-ink [font-variant-numeric:tabular-nums]">
              {count?.toLocaleString("en-US")}
            </span>
          )}
          {deltaCents !== undefined && (
            <p className={`text-body-s ${deltaCents < 0 ? "text-negative" : "text-positive"}`}>
              <Money cents={deltaCents} delta />
            </p>
          )}
        </div>
        {href && <ArrowChip href={href} label={hrefLabel ?? label} />}
      </div>
    </article>
  );
}
