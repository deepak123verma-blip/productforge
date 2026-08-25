import Link from "next/link";

/**
 * Legal pages shell. These MUST resolve (Stripe's reviewers follow them),
 * but the bodies are drafts until counsel signs off — hence the banner.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-gap p-tight min-[640px]:p-loose">
      <p className="rounded-field bg-butter p-tight text-body-s font-medium text-ink">
        TODO: lawyer review — this is a working draft, not final legal text.
      </p>
      <nav className="flex flex-wrap gap-tight text-body-s text-ink-2">
        <Link href="/">← ProductForge</Link>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/creator-agreement">Creator agreement</Link>
        <Link href="/legal/refund-policy">Refund policy</Link>
        <Link href="/legal/privacy">Privacy</Link>
      </nav>
      <article className="flex flex-col gap-gap [&_h1]:font-display [&_h1]:text-display-m [&_h1]:font-bold [&_h1]:tracking-[-0.02em] [&_h2]:font-display [&_h2]:text-display-s [&_h2]:font-bold [&_p]:text-body [&_p]:text-ink-2 [&_li]:text-body [&_li]:text-ink-2">
        {children}
      </article>
    </main>
  );
}
