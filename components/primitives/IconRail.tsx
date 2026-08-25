import Link from "next/link";

/**
 * Icon rail — a separate floating element on the canvas (own shadow-panel),
 * 72px wide. Active item: filled --ink circle, white glyph. Under 640px it
 * becomes a fixed bottom bar with at most 5 items (spec §3.2).
 */

export interface RailItem {
  href: string;
  label: string;
  glyph: React.ReactNode;
  /** Included in the <640px bottom bar (max 5). */
  compact?: boolean;
}

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const railItems: RailItem[] = [
  { href: "/home", label: "Home", compact: true, glyph: <Glyph d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" /> },
  { href: "/products", label: "Products", compact: true, glyph: <Glyph d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" /> },
  { href: "/sales", label: "Sales", glyph: <Glyph d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3" /> },
  { href: "/traffic", label: "Traffic", compact: true, glyph: <Glyph d="M4 12h6m4 0h6M12 4v6m0 4v6M7 7l3 3m4 4l3 3" /> },
  { href: "/customers", label: "Customers", glyph: <Glyph d="M16 19a4 4 0 00-8 0M12 11a3 3 0 100-6 3 3 0 000 6zm7 8a6 6 0 00-3-5m-11 5a6 6 0 013-5" /> },
  { href: "/payouts", label: "Payouts", compact: true, glyph: <Glyph d="M3 8h18v10H3zM3 8l2-3h14l2 3M8 13h4" /> },
  { href: "/referrals", label: "Referrals", glyph: <Glyph d="M12 8a3 3 0 100-6 3 3 0 000 6zm-6 14a3 3 0 100-6 3 3 0 000 6zm12 0a3 3 0 100-6 3 3 0 000 6zM12 8v5m-4 4l4-4m4 4l-4-4" /> },
  { href: "/settings", label: "Settings", compact: true, glyph: <Glyph d="M12 15a3 3 0 100-6 3 3 0 000 6zm7-3l2-1-1-3-2 .3a7 7 0 00-1.5-1.5L17 4l-3-1-1 2a7 7 0 00-2 0L10 3 7 4l.5 2.8A7 7 0 006 8.3L4 8l-1 3 2 1a7 7 0 000 2l-2 1 1 3 2-.3a7 7 0 001.5 1.5L7 22l3 1 1-2a7 7 0 002 0l1 2 3-1-.5-2.8a7 7 0 001.5-1.5l2 .3 1-3-2-1a7 7 0 000-2z" /> },
];

export function IconRail({ activeHref }: { activeHref: string }) {
  return (
    <>
      {/* Floating rail ≥640px */}
      <nav
        aria-label="Main"
        className="hidden w-rail shrink-0 flex-col items-center gap-tight self-start rounded-panel bg-surface py-gap shadow-panel min-[640px]:flex"
      >
        {railItems.map((item) => (
          <RailLink key={item.href} item={item} active={activeHref === item.href} />
        ))}
      </nav>
      {/* Bottom bar <640px — 5 items max */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around bg-surface py-1 shadow-lift min-[640px]:hidden"
      >
        {railItems.filter((i) => i.compact).slice(0, 5).map((item) => (
          <RailLink key={item.href} item={item} active={activeHref === item.href} />
        ))}
      </nav>
    </>
  );
}

function RailLink({ item, active }: { item: RailItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 w-11 items-center justify-center rounded-chip ${
        active ? "bg-ink text-surface" : "text-ink-3 hover:bg-surface-sunk hover:text-ink-2"
      }`}
    >
      {item.glyph}
    </Link>
  );
}
