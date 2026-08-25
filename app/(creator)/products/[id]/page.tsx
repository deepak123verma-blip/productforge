import { notFound } from "next/navigation";
import { CreatorShell } from "../../../../components/creator/CreatorShell";
import { VersionPublisher } from "../../../../components/creator/VersionPublisher";
import { requireCreator } from "../../../../lib/auth/require";
import { AssetRow } from "../../../../components/primitives/AssetRow";
import { Button } from "../../../../components/primitives/Button";
import { Field } from "../../../../components/primitives/Field";
import { Money } from "../../../../components/primitives/Money";
import { StatusChip } from "../../../../components/primitives/StatusChip";
import { getRepository } from "../../../../lib/db/repositories";

export default async function ProductEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const product = await repo.getProduct(id);
  if (!product || product.creatorId !== me.id) notFound();

  const status =
    product.status === "live" && product.reviewState === "pending"
      ? ("under_review" as const)
      : product.status === "restricted"
        ? ("restricted" as const)
        : product.status === "draft"
          ? ("draft" as const)
          : ("live" as const);

  return (
    <CreatorShell title={product.title} displayName={me.displayName}>
      <div className="grid grid-cols-1 gap-loose min-[900px]:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-section">
          <section aria-label="Assets" className="flex flex-col gap-gap">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Assets</h2>
              <Button variant="secondary">Add asset</Button>
            </div>
            <div className="flex flex-col gap-tight">
              {product.assets.map((a) => (
                <AssetRow key={a.id} title={a.title} format={a.format} meta={a.meta} editable />
              ))}
            </div>
            <p className="text-body-s text-ink-3">Drag to reorder. Buyers see assets in this order.</p>
          </section>

          <VersionPublisher
            productTitle={product.title}
            currentVersion={product.version}
            buyerCount={product.lifetimeSales}
          />

          <section aria-label="Details" className="flex max-w-lg flex-col gap-gap">
            <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Details</h2>
            <Field label="Title" defaultValue={product.title} />
            <Field label="Description" defaultValue={product.description} />
            <Field label="Price" defaultValue={String(Math.floor(product.priceCents / 100))} hint="Minimum $5.00" />
          </section>
        </div>

        <aside className="flex flex-col gap-gap">
          <div className="flex flex-col items-start gap-tight rounded-card bg-surface-sunk p-gap">
            <StatusChip status={status} />
            <p className="text-body-s text-ink-2">
              {product.lifetimeSales} sales · <Money cents={product.lifetimeRevenueCents} /> lifetime
            </p>
            <p className="text-body-s text-ink-2">
              Price <Money cents={product.priceCents} className="font-medium" />
            </p>
            <Button>Publish</Button>
          </div>
          <div className="rounded-card bg-butter p-gap">
            <p className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">Cover</p>
            <span aria-hidden="true" className="mt-tight flex h-24 w-24 items-center justify-center rounded-tile bg-surface text-display-l">
              {product.coverEmoji}
            </span>
          </div>
        </aside>
      </div>
    </CreatorShell>
  );
}
