import { notFound } from "next/navigation";
import { AssetRow } from "../../../../components/primitives/AssetRow";
import { Button } from "../../../../components/primitives/Button";
import { Money } from "../../../../components/primitives/Money";
import { NotYetWired } from "../../../../components/primitives/NotYetWired";
import { getRepository } from "../../../../lib/db/repositories";

/**
 * Product page — single column, no nav, nothing competing with the buy
 * action. "What's inside" is the whole argument for a bundle.
 * The buy button is a placeholder until Stripe Checkout exists (Phase 2).
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = await params;
  const decoded = decodeURIComponent(handle);
  if (!decoded.startsWith("@")) notFound();
  const found = await getRepository().getStorefrontProduct(decoded.slice(1), slug);
  if (!found || found.product.status !== "live") notFound();
  const { product } = found;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-loose p-tight min-[640px]:p-loose">
      <div aria-hidden="true" className="flex h-48 items-center justify-center rounded-card bg-surface text-display-xl">
        {product.coverEmoji}
      </div>

      <header className="flex flex-col gap-tight">
        <h1 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">{product.title}</h1>
        <Money cents={product.priceCents} className="text-stat font-bold leading-stat text-ink" />
        <p className="text-body text-ink-2">{product.description}</p>
      </header>

      <section aria-label="What's inside" className="flex flex-col gap-tight">
        <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">What's inside</h2>
        {product.assets.map((a) => (
          <AssetRow key={a.id} title={a.title} format={a.format} meta={a.meta} />
        ))}
      </section>

      <section aria-label="Preview" className="flex gap-tight overflow-x-auto">
        {[1, 2, 3].map((n) => (
          <div key={n} aria-hidden="true" className="h-40 w-32 shrink-0 rounded-field bg-surface-sunk" />
        ))}
      </section>

      <section aria-label="Refund policy" className="rounded-card bg-surface p-gap">
        <p className="text-body-s text-ink-2">
          Changed your mind? Get a full refund within 14 days — one click, no questions.
        </p>
      </section>

      <Button disabled>Buy</Button>
      <div className="self-center">
        <NotYetWired stubId="checkout" />
      </div>
    </main>
  );
}
