import { CreatorShell } from "../../../components/creator/CreatorShell";
import { ArrowChip } from "../../../components/primitives/ArrowChip";
import { EmptyState } from "../../../components/primitives/EmptyState";
import { ProductCard } from "../../../components/primitives/ProductCard";
import { getRepository } from "../../../lib/db/repositories";
import { requireCreator } from "../../../lib/auth/require";
import type { Product } from "../../../lib/db/repositories";

function chipStatus(p: Product) {
  if (p.status === "live" && p.reviewState === "pending") return "under_review" as const;
  if (p.status === "restricted") return "restricted" as const;
  if (p.status === "draft") return "draft" as const;
  return "live" as const;
}

export default async function ProductsPage() {
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const products = await repo.listProducts(me.id);

  return (
    <CreatorShell title="Products" displayName={me.displayName}>
      <div className="mb-section grid grid-cols-1 gap-gap min-[640px]:grid-cols-2">
        <article className="relative flex min-h-feature-card flex-col rounded-card bg-butter p-gap">
          <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Upload what you have</h2>
          <p className="mt-1 text-body-s text-ink-2">Files you already own — drop them in, price them, publish.</p>
          <div className="mt-auto flex justify-end">
            <ArrowChip href="/products/new" label="Upload what you have" />
          </div>
        </article>
        <article className="relative flex min-h-feature-card flex-col rounded-card bg-lilac p-gap">
          <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Make something new</h2>
          <p className="mt-1 text-body-s text-ink-2">Describe it, we draft it. You approve every outline first.</p>
          <div className="mt-auto flex justify-end">
            <ArrowChip href="/products/new" label="Make something new" />
          </div>
        </article>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          line="Upload a file or make something new — either takes about two minutes."
          actionLabel="Create product"
          actionHref="/products/new"
        />
      ) : (
        <div className="grid grid-cols-1 gap-gap min-[640px]:grid-cols-2 min-[1280px]:grid-cols-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              title={p.title}
              status={chipStatus(p)}
              assetCount={p.assets.length}
              sales={p.lifetimeSales}
              href={`/products/${p.id}`}
              coverEmoji={p.coverEmoji}
            />
          ))}
        </div>
      )}
    </CreatorShell>
  );
}
