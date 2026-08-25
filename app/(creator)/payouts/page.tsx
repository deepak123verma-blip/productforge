import { CreatorShell } from "../../../components/creator/CreatorShell";
import { Money } from "../../../components/primitives/Money";
import { NotYetWired } from "../../../components/primitives/NotYetWired";
import { requireCreator } from "../../../lib/auth/require";
import { Table } from "../../../components/primitives/Table";
import { getRepository } from "../../../lib/db/repositories";

const stateLabel: Record<string, string> = {
  pending: "Assembling",
  confirmed: "Approved",
  executing: "On its way",
  sent: "Sent",
  failed: "Didn't go through",
};

export default async function PayoutsPage() {
  const repo = getRepository();
  const { creator: me } = await requireCreator();
  const [summary, history] = await Promise.all([repo.payoutSummary(me.id), repo.listPayouts(me.id)]);

  return (
    <CreatorShell title="Payouts" displayName={me.displayName}>
      <div className="flex flex-col gap-section">
        <section aria-label="Balance" className="rounded-card bg-mint p-loose">
          <dl className="grid grid-cols-1 gap-gap min-[640px]:grid-cols-3">
            <div>
              <dt className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">Available now</dt>
              <dd className="mt-1"><Money cents={summary.availableCents} className="text-stat font-bold leading-stat text-ink" /></dd>
              <dd className="text-body-s text-ink-2">goes out {summary.nextPayoutDateLabel}</dd>
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">Clearing</dt>
              <dd className="mt-1"><Money cents={summary.clearingCents} className="text-stat font-bold leading-stat text-ink" /></dd>
              <dd className="text-body-s text-ink-2">available from {summary.clearingDateLabel}</dd>
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-[0.04em] text-ink-2">On hold</dt>
              <dd className="mt-1"><Money cents={summary.onHoldCents} className="text-stat font-bold leading-stat text-ink" /></dd>
              <dd className="text-body-s text-ink-2">released after your first 90 days</dd>
            </div>
          </dl>
        </section>

        <section aria-label="History" className="flex flex-col gap-gap">
          <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">History</h2>
          <Table
            caption="Payout history"
            headers={["Period", "Sales", "Referrals", "Refunds & disputes", "Reserve held", "Reserve released", "Net", "Status"]}
          >
            {history.map((p) => (
              <tr key={p.id} className="border-b border-hairline">
                <td className="whitespace-nowrap px-tight py-tight">{p.periodLabel}</td>
                <td className="px-tight py-tight"><Money cents={p.salesCents} /></td>
                <td className="px-tight py-tight"><Money cents={p.referralCents} /></td>
                <td className="px-tight py-tight"><Money cents={-p.clawedCents} /></td>
                <td className="px-tight py-tight"><Money cents={-p.reserveHeldCents} /></td>
                <td className="px-tight py-tight"><Money cents={p.reserveReleasedCents} /></td>
                <td className="px-tight py-tight font-medium"><Money cents={p.netCents} /></td>
                <td className="whitespace-nowrap px-tight py-tight">{stateLabel[p.state]}</td>
              </tr>
            ))}
          </Table>
          <p className="text-body-s text-ink-3">
            Every statement reconstructs to the cent: sales + referrals − refunds and disputes − reserve held + reserve released = net.
          </p>
          <NotYetWired stubId="payout-run" />
        </section>

        <section aria-label="Bank details" className="rounded-card bg-surface-sunk p-gap">
          <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Payout account</h2>
          <p className="mt-1 text-body-s text-ink-2">
            Bank details are managed on your secure payout account page.
          </p>
          <NotYetWired stubId="kyc-connect" className="mt-tight" />
        </section>
      </div>
    </CreatorShell>
  );
}
