import { Button } from "../../components/primitives/Button";
import { NotYetWired } from "../../components/primitives/NotYetWired";
import { PurchaseCard } from "../../components/store/PurchaseCard";
import { getRepository } from "../../lib/db/repositories";

/**
 * /access — a receipt, not a dashboard (PRD §6.4). Email in, purchases
 * out, with current versions and changelogs. The magic-link send is
 * stubbed; on fixtures, submitting the form shows the purchases
 * directly so the post-auth view is fully exercised.
 */
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const purchases = email ? await getRepository().listPurchases(email) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-loose p-tight min-[640px]:p-loose">
      <header>
        <h1 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Your purchases</h1>
        <p className="mt-1 text-body text-ink-2">
          Enter the email you bought with and we'll send you a secure link to everything you own.
        </p>
      </header>

      <form method="get" className="flex flex-col gap-tight" aria-label="Find your purchases">
        <label htmlFor="access-email" className="text-body-s font-medium text-ink">Email</label>
        <div className="flex gap-tight">
          <input
            id="access-email"
            name="email"
            type="email"
            required
            defaultValue={email ?? ""}
            placeholder="you@example.com"
            className="h-11 flex-1 rounded-field bg-surface-sunk px-tight text-body text-ink placeholder:text-ink-3"
          />
          <Button type="submit">Send my link</Button>
        </div>
        <NotYetWired stubId="access-magic-link" />
      </form>

      {purchases !== null && (
        <section aria-label="Purchases" className="flex flex-col gap-gap">
          {purchases.length === 0 ? (
            <p className="rounded-card bg-surface p-gap text-body text-ink-2">
              No purchases under that email. Check the address on your receipt.
            </p>
          ) : (
            purchases.map((p) => <PurchaseCard key={p.orderId} purchase={p} />)
          )}
        </section>
      )}
    </main>
  );
}
