import { ArrowChip } from "./ArrowChip";
import { StatusChip } from "./StatusChip";
import { type ProductStatus } from "./tokens";

/**
 * Product feature card — --butter fill (products domain), status chip
 * top-right, display-s title, meta in --ink-2, arrow chip bottom-right.
 * No border, no shadow.
 */
export function ProductCard({
  title,
  status,
  assetCount,
  sales,
  href,
  coverEmoji = "📄",
}: {
  title: string;
  status: ProductStatus;
  assetCount: number;
  sales: number;
  href: string;
  coverEmoji?: string;
}) {
  return (
    <article className="relative flex min-h-feature-card flex-col rounded-card bg-butter p-gap">
      <div className="flex items-start justify-between">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-tile bg-surface text-display-s"
        >
          {coverEmoji}
        </span>
        <StatusChip status={status} />
      </div>
      <h3 className="mt-tight font-display text-display-s font-bold tracking-[-0.02em] text-ink">{title}</h3>
      <div className="mt-auto flex items-end justify-between">
        <p className="text-body-s text-ink-2">
          {assetCount} {assetCount === 1 ? "asset" : "assets"} · {sales} {sales === 1 ? "sale" : "sales"}
        </p>
        <ArrowChip href={href} label={`Open ${title}`} />
      </div>
    </article>
  );
}
