"use client";

import { usePathname } from "next/navigation";
import { IconRail } from "../primitives/IconRail";
import { Panel } from "../primitives/Panel";

/**
 * The authenticated shell (spec §3.1): textured canvas, floating icon
 * rail, floating surface panel with header. Below 640px the rail becomes
 * a bottom bar (handled inside IconRail) — pad the bottom so content
 * clears it.
 */
export function CreatorShell({
  title,
  displayName,
  children,
}: {
  title: string;
  displayName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = "/" + (pathname.split("/")[1] ?? "");
  return (
    <div className="flex min-h-screen justify-center gap-gap p-tight pb-16 min-[640px]:p-loose min-[640px]:pb-loose">
      <IconRail activeHref={active} />
      <Panel>
        <header className="mb-section flex flex-wrap items-center justify-between gap-gap">
          <h1 className="font-display text-display-l font-bold tracking-[-0.02em] text-ink">{title}</h1>
          <div className="flex items-center gap-tight">
            <label className="sr-only" htmlFor="global-search">Search</label>
            <input
              id="global-search"
              type="search"
              placeholder="Search"
              className="hidden h-11 w-56 rounded-chip bg-surface-sunk px-gap text-body text-ink placeholder:text-ink-3 min-[900px]:block"
            />
            <span
              aria-label={displayName}
              className="flex h-11 w-11 items-center justify-center rounded-chip bg-mint text-body font-semibold text-ink"
            >
              {displayName.charAt(0)}
            </span>
          </div>
        </header>
        {children}
      </Panel>
    </div>
  );
}
