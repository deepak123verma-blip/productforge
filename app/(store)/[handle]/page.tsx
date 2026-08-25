import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowChip } from "../../../components/primitives/ArrowChip";
import { Money } from "../../../components/primitives/Money";
import { pastelBg } from "../../../components/primitives/tokens";
import { getRepository } from "../../../lib/db/repositories";

/**
 * Storefront — /@handle. Mobile-first (most visitors arrive from an
 * in-app browser). The creator's chosen accent tints the featured card
 * and nothing else.
 */
export default async function StorefrontPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);
  if (!decoded.startsWith("@")) notFound();
  const repo = getRepository();
  const creator = await repo.getCreatorByHandle(decoded.slice(1));
  if (!creator || creator.restricted) notFound();
  const products = (await repo.listProducts(creator.id)).filter((p) => p.status === "live");
  const [featured, ...rest] = [...products].sort((a, b) => b.lifetimeSales - a.lifetimeSales);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-loose p-tight min-[640px]:p-loose">
      <header className="flex flex-col items-center gap-tight text-center">
        <span aria-hidden="true" className={`flex h-16 w-16 items-center justify-center rounded-chip text-display-m ${pastelBg[creator.accent]}`}>
          {creator.displayName.charAt(0)}
        </span>
        <h1 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">{creator.displayName}</h1>
        <p className="text-body-s text-ink-2">{creator.bio}</p>
      </header>

      {featured && (
        <article className={`relative rounded-card p-gap ${pastelBg[creator.accent]}`}>
          <p className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">Featured</p>
          <h2 className="mt-1 font-display text-display-s font-bold tracking-[-0.02em] text-ink">{featured.title}</h2>
          <p className="mt-1 text-body-s text-ink-2">
            {featured.assets.length} {featured.assets.length === 1 ? "thing" : "things"} inside ·{" "}
            <Money cents={featured.priceCents} className="font-medium" />
          </p>
          <div className="mt-tight flex justify-end">
            <ArrowChip href={`/@${creator.handle}/${featured.slug}`} label={`Open ${featured.title}`} />
          </div>
        </article>
      )}

      <div className="grid grid-cols-1 gap-gap min-[640px]:grid-cols-2">
        {rest.map((p) => (
          <Link
            key={p.id}
            href={`/@${creator.handle}/${p.slug}`}
            className="flex items-center gap-tight rounded-card bg-surface p-gap"
          >
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-tile bg-surface-sunk text-display-s">
              {p.coverEmoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-ink">{p.title}</span>
              <span className="block text-body-s text-ink-3">
                {p.kind === "bundle" ? "Bundle · " : ""}
                {p.assets.length} inside
              </span>
            </span>
            <Money cents={p.priceCents} className="text-body font-medium" />
          </Link>
        ))}
      </div>
    </main>
  );
}
