import { CreatorShell } from "../../../../components/creator/CreatorShell";
import { NotYetWired } from "../../../../components/primitives/NotYetWired";
import { UploadFlow } from "../../../../components/creator/UploadFlow";
import { requireCreator } from "../../../../lib/auth/require";

export default async function NewProductPage() {
  const { creator: me } = await requireCreator();
  return (
    <CreatorShell title="Create product" displayName={me.displayName}>
      <div className="flex flex-col gap-section">
        <UploadFlow />
        <section aria-label="Make something new" className="rounded-card bg-lilac p-gap">
          <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Make something new</h2>
          <p className="mt-1 text-body-s text-ink-2">
            Describe what you know, pick one of five product packages, approve the outline, and we draft every asset.
          </p>
          <NotYetWired stubId="generation" className="mt-tight" />
        </section>
      </div>
    </CreatorShell>
  );
}
