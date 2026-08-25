import { CreatorShell } from "../../../components/creator/CreatorShell";
import { Field } from "../../../components/primitives/Field";
import { NotYetWired } from "../../../components/primitives/NotYetWired";
import { requireCreator } from "../../../lib/auth/require";

/** Settings shell on mock data — saving, tax forms, and the payout account link arrive with live services. */
export default async function SettingsPage() {
  const { creator: me } = await requireCreator();
  return (
    <CreatorShell title="Settings" displayName={me.displayName}>
      <div className="flex max-w-lg flex-col gap-gap">
        <Field label="Display name" defaultValue={me.displayName} />
        <Field label="Handle" defaultValue={me.handle} hint="Your storefront lives at /@handle. Locked after your first sale." />
        <Field label="Bio" defaultValue={me.bio} />
        <div className="rounded-card bg-surface-sunk p-gap">
          <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Payout account</h2>
          <p className="mt-1 text-body-s text-ink-2">
            {me.kycStatus === "verified" ? "Verified and ready for payouts." : "Not verified yet — payouts wait until this is done."}
          </p>
          <NotYetWired stubId="kyc-connect" className="mt-tight" />
        </div>
      </div>
    </CreatorShell>
  );
}
