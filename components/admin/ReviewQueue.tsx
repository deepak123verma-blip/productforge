"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AssetRow } from "../primitives/AssetRow";
import { Money } from "../primitives/Money";
import type { ReviewQueueItem } from "../../lib/db/repositories/types";

type Decision = "cleared" | "restricted" | "removed";

const resultTone: Record<"pass" | "flag" | "fail", string> = {
  pass: "text-positive",
  flag: "text-warning",
  fail: "text-negative",
};

/**
 * Keyboard-driven review queue: J/K move, A clear, R restrict, X remove.
 * Target under 60 seconds per item — everything visible without clicks.
 * Decisions are local state until the live backend exists.
 */
export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const pending = items.filter((i) => !decisions[i.id]);
  const current = pending[Math.min(index, Math.max(0, pending.length - 1))];

  const decide = useCallback(
    (d: Decision) => {
      if (!current) return;
      setDecisions((prev) => ({ ...prev, [current.id]: d }));
      setIndex((i) => Math.max(0, Math.min(i, pending.length - 2)));
    },
    [current, pending.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case "j":
          setIndex((i) => Math.min(i + 1, pending.length - 1));
          break;
        case "k":
          setIndex((i) => Math.max(i - 1, 0));
          break;
        case "a":
          decide("cleared");
          break;
        case "r":
          decide("restricted");
          break;
        case "x":
          decide("removed");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, pending.length]);

  if (!current) {
    return (
      <div className="rounded-field bg-mint p-gap">
        <p className="text-body font-medium text-ink">Queue clear — {Object.keys(decisions).length} reviewed.</p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="grid grid-cols-1 gap-gap min-[900px]:grid-cols-[1fr_2fr]">
      <nav aria-label="Review queue" className="flex flex-col gap-1">
        <p className="mb-1 text-caption font-semibold uppercase tracking-[0.04em] text-ink-2">
          {pending.length} pending · <kbd>J</kbd>/<kbd>K</kbd> move · <kbd>A</kbd> clear · <kbd>R</kbd> restrict · <kbd>X</kbd> remove
        </p>
        {pending.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? "true" : undefined}
            className={`flex items-center justify-between rounded-field px-tight py-tight text-left text-body-s ${
              i === index ? "bg-ink text-surface" : "bg-surface-sunk text-ink"
            }`}
          >
            <span className="truncate">{item.productTitle}</span>
            <span className={i === index ? "text-surface" : "text-ink-3"}>@{item.creatorHandle}</span>
          </button>
        ))}
        {Object.entries(decisions).length > 0 && (
          <p className="mt-tight text-caption text-ink-3">
            Decided: {Object.entries(decisions).map(([id, d]) => `${items.find((x) => x.id === id)?.productTitle} → ${d}`).join(" · ")}
          </p>
        )}
      </nav>

      <article aria-label={`Reviewing ${current.productTitle}`} className="flex flex-col gap-gap rounded-field bg-surface-sunk p-gap">
        <header className="flex flex-wrap items-baseline gap-tight">
          <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">{current.productTitle}</h2>
          <span className="text-body-s text-ink-2">@{current.creatorHandle}</span>
          <span className="rounded-chip bg-butter px-tight text-caption font-medium text-ink">{current.tier} review</span>
          {current.linkOnly && <span className="rounded-chip bg-blush px-tight text-caption font-medium text-ink">link-only</span>}
          <Money cents={current.priceCents} className="ml-auto text-body font-medium" />
        </header>

        <div className="flex flex-col gap-1">
          {current.assets.map((a) => (
            <AssetRow key={a.id} title={a.title} format={a.format} meta={a.meta} />
          ))}
        </div>

        <table className="w-full text-body-s">
          <caption className="sr-only">Safety check results</caption>
          <tbody>
            {current.safetyResults.map((s) => (
              <tr key={s.check} className="border-b border-hairline">
                <th scope="row" className="py-1 pr-tight text-left font-medium text-ink">{s.check}</th>
                <td className={`py-1 pr-tight font-semibold uppercase ${resultTone[s.result]}`}>{s.result}</td>
                <td className="py-1 text-ink-2">{s.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex gap-tight">
          <button type="button" onClick={() => decide("cleared")} className="h-11 rounded-chip bg-ink px-loose text-body font-medium text-surface">
            Clear (A)
          </button>
          <button type="button" onClick={() => decide("restricted")} className="h-11 rounded-chip bg-blush px-loose text-body font-medium text-ink">
            Restrict (R)
          </button>
          <button type="button" onClick={() => decide("removed")} className="h-11 rounded-chip bg-surface px-loose text-body font-medium text-negative">
            Remove (X)
          </button>
        </div>
      </article>
    </div>
  );
}
