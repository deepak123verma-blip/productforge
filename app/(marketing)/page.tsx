import Link from "next/link";
import { Button } from "../../components/primitives/Button";
import { DashboardMiniature } from "../../components/store/DashboardMiniature";
import { Money } from "../../components/primitives/Money";

/**
 * The landing page (PRD §4). One job: get a creator to publish their
 * first product. One CTA string everywhere: "Start selling."
 * Under 400KB excluding fonts — no images, the hero is live components.
 */

const CTA = "Start selling";

const formats = [
  "Guides", "Planners", "Checklists", "Templates", "Spreadsheets", "Prompt packs",
  "Swipe files", "Workbooks", "Trackers", "Scripts", "Presets", "Bundles",
];

const dontDo = [
  ["Checkout", "Hosted, taxed, and receipted the moment someone taps buy."],
  ["Sales tax & VAT", "Calculated at the buyer's location on every sale."],
  ["Hosting & delivery", "Files stored, secured, and delivered instantly."],
  ["Receipts", "Every buyer gets one, automatically."],
  ["Refunds", "Self-service for buyers, no tickets for you."],
  ["Fraud", "Screened before it ever reaches your numbers."],
  ["Buyer support", "Lost link? Expired download? Handled."],
  ["Repeat access", "Buyers always have the latest version of what they bought."],
] as const;

const faq = [
  ["When do I get paid?", "Every Monday, straight to your bank. New sales clear over two weeks first — that's what makes buyer refunds painless for everyone."],
  ["Which countries can sell?", "Anywhere Stripe supports payouts, including India, the UK, the EU, Canada and Australia. Buyers can pay from anywhere."],
  ["What about refunds?", "Buyers can refund themselves within 14 days, one click, no questions. It comes out of the sale, never out of your pocket beyond that sale."],
  ["Who owns my products?", "You do, always. You licence us to sell them for you and can unpublish any time. Your buyers keep what they bought."],
  ["What if a buyer disputes a charge?", "We answer it with the delivery evidence we log on every sale — download times, receipts, access history. You don't do anything."],
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-panel flex-col gap-section p-tight min-[640px]:p-loose">
      {/* Nav */}
      <nav className="flex items-center justify-between">
        <span className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">ProductForge</span>
        <div className="flex items-center gap-tight">
          <Link href="/login" className="text-body-s font-medium text-ink-2">Log in</Link>
          <Button href="/home">{CTA}</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid grid-cols-1 items-center gap-loose min-[900px]:grid-cols-2" aria-label="Hero">
        <div className="flex flex-col items-start gap-gap">
          <h1 className="font-display text-display-xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            Sell what you know. Keep 75%.
          </h1>
          <p className="text-display-s text-ink-2">
            Make it or upload it, sell it from one link, and get paid every Monday.
          </p>
          <Button href="/home">{CTA}</Button>
        </div>
        <div className="flex justify-center min-[900px]:justify-end">
          <DashboardMiniature />
        </div>
      </section>

      {/* Attribution — position two, the strongest argument (ruling A3) */}
      <section aria-label="One link that tells you what worked" className="flex flex-col gap-gap">
        <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">
          One link. And it tells you what worked.
        </h2>
        <p className="max-w-lg text-body text-ink-2">
          Make a tracked link for each reel, story or video. Then stop guessing which content pays the bills:
        </p>
        <div className="max-w-lg rounded-card bg-lilac p-gap">
          <p className="font-figures text-display-s text-ink [font-variant-numeric:tabular-nums]">
            Reel #34 → 412 clicks → 31 sales → <Money cents={60_400} />
          </p>
          <p className="mt-1 text-body-s text-ink-2">7.5% of the people who tapped, bought. Make more like this one.</p>
        </div>
      </section>

      {/* What you can sell */}
      <section aria-label="What you can sell" className="flex flex-col gap-gap">
        <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">What you can sell</h2>
        <div className="flex flex-wrap gap-tight">
          {formats.map((f) => (
            <span key={f} className="rounded-chip bg-butter px-tight py-1 text-body-s font-medium text-ink">
              {f}
            </span>
          ))}
        </div>
        <p className="text-body text-ink-2">If it helps someone and fits in a file or a link, you can sell it here. From $5.</p>
      </section>

      {/* How the money works */}
      <section aria-label="How the money works" className="flex flex-col gap-gap rounded-card bg-mint p-loose">
        <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">How the money works</h2>
        <div className="overflow-x-auto">
          <table className="w-full max-w-lg border-collapse text-body">
            <caption className="sr-only">Pricing terms</caption>
            <tbody>
              {[
                ["Your cut", "75% of every sale"],
                ["Monthly fee", "None. Ever."],
                ["Payouts", "Weekly, every Monday"],
                ["Minimum price", "$5"],
                ["Card fees", "Deducted before the split — see below"],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-hairline">
                  <th scope="row" className="py-tight pr-gap text-left font-medium text-ink">{k}</th>
                  <td className="py-tight text-ink-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-lg text-body text-ink-2">
          The honest version, because everyone else buries it: card processing (about 2.9% + 30¢) comes off first, and
          you keep 75% of what's left. On a $5 sale that's <Money cents={341} className="font-medium text-ink" /> to
          you — worked to the cent, on every receipt, no surprises on payday.
        </p>
      </section>

      {/* What you don't have to do */}
      <section aria-label="What you don't have to do" className="flex flex-col gap-gap">
        <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">What you don't have to do</h2>
        <div className="grid grid-cols-1 gap-tight min-[640px]:grid-cols-2">
          {dontDo.map(([k, v]) => (
            <div key={k} className="rounded-field bg-surface p-tight">
              <p className="text-body font-medium text-ink">{k}</p>
              <p className="text-body-s text-ink-2">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Referral — short, never the headline */}
      <section aria-label="Invite creators" className="rounded-card bg-sky p-gap">
        <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Invite creators, earn 5%</h2>
        <p className="mt-1 max-w-lg text-body-s text-ink-2">
          Know someone with something to sell? You earn 5% of what ProductForge makes from creators you invite, for
          their first 12 months. Paid with your normal weekly payout.
        </p>
      </section>

      {/* FAQ */}
      <section aria-label="FAQ" className="flex max-w-lg flex-col gap-tight">
        <h2 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Questions, answered</h2>
        {faq.map(([q, a]) => (
          <details key={q} className="rounded-field bg-surface p-tight">
            <summary className="cursor-pointer text-body font-medium text-ink">{q}</summary>
            <p className="mt-1 text-body-s text-ink-2">{a}</p>
          </details>
        ))}
      </section>

      {/* Closing CTA */}
      <section className="flex flex-col items-center gap-gap rounded-card bg-butter p-loose text-center">
        <h2 className="font-display text-display-l font-bold tracking-[-0.02em] text-ink">
          Your first product can be live today.
        </h2>
        <Button href="/home">{CTA}</Button>
      </section>

      {/* Footer */}
      <footer className="flex flex-wrap items-center gap-gap border-t border-hairline py-gap text-body-s text-ink-2">
        <span className="font-medium text-ink">ProductForge</span>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/creator-agreement">Creator agreement</Link>
        <Link href="/legal/refund-policy">Refund policy</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <a href="mailto:hello@productforge.com">Contact</a>
      </footer>
    </main>
  );
}
