import Link from "next/link";

/**
 * The signature element — the ONLY "open this" affordance on cards.
 * 32px visual circle, 44px hit area. Present on navigable cards, absent
 * from terminal ones. Hover motion lives in globals.css (.arrow-chip).
 */
export function ArrowChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center"
    >
      <span
        aria-hidden="true"
        className="arrow-chip flex h-8 w-8 items-center justify-center rounded-chip bg-surface text-ink text-body-s"
      >
        →
      </span>
    </Link>
  );
}
