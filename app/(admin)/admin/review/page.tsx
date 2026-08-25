import { ReviewQueue } from "../../../../components/admin/ReviewQueue";
import { getRepository } from "../../../../lib/db/repositories";

import { requireAdmin } from "../../../../lib/auth/require";

/**
 * Admin register: same tokens, denser — tables over cards, body-s base.
 * Role-gated through the session interface; the mock session is an
 * admin, so this is reachable offline. The real provider drops in
 * without touching this page.
 */
export default async function AdminReviewPage() {
  await requireAdmin();
  const items = await getRepository().reviewQueue();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-panel flex-col gap-gap p-tight text-body-s min-[640px]:p-loose">
      <h1 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Review queue</h1>
      <ReviewQueue items={items} />
    </main>
  );
}
