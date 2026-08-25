"use client";

import { useState } from "react";
import { AssetRow } from "../primitives/AssetRow";
import { Money } from "../primitives/Money";
import { NotYetWired } from "../primitives/NotYetWired";
import type { Purchase } from "../../lib/db/repositories/types";

/**
 * One purchase on /access: current-version assets, changelog history,
 * and the one-click refund (full UI; the Stripe call itself is stubbed —
 * see lib/stubs/registry.ts "refund").
 */
export function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const [refundStep, setRefundStep] = useState<"idle" | "confirm" | "done">(
    purchase.state === "refunded" ? "done" : "idle"
  );
  const [showHistory, setShowHistory] = useState(false);

  return (
    <article className="flex flex-col gap-tight rounded-card bg-surface p-gap">
      <header className="flex flex-wrap items-baseline gap-tight">
        <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">{purchase.productTitle}</h2>
        <span className="text-body-s text-ink-3">
          by @{purchase.creatorHandle} · bought {purchase.purchasedLabel} · <Money cents={purchase.pricePaidCents} />
        </span>
      </header>

      {refundStep === "done" ? (
        <p className="rounded-field bg-surface-sunk p-tight text-body text-ink-2" aria-live="polite">
          <strong className="text-ink">Refunded.</strong> Your <Money cents={purchase.pricePaidCents} /> is on its way
          back to your card — usually 5–10 business days. Download links for this product no longer work.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {purchase.assets.map((a) => (
              <AssetRow key={a.id} title={a.title} format={a.format} meta={a.meta} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-tight">
            <span className="rounded-chip bg-mint px-tight py-1 text-caption font-medium text-ink">
              Version {purchase.currentVersion} — you always have the latest
            </span>
            <button
              type="button"
              className="text-body-s text-ink-2 underline"
              onClick={() => setShowHistory((s) => !s)}
              aria-expanded={showHistory}
            >
              {showHistory ? "Hide what's changed" : "See what's changed"}
            </button>
          </div>

          {showHistory && (
            <ul className="flex flex-col gap-1 rounded-field bg-surface-sunk p-tight">
              {purchase.versions.map((v) => (
                <li key={v.version} className="text-body-s text-ink-2">
                  <strong className="text-ink">v{v.version}</strong> · {v.dateLabel} — {v.changelog}
                </li>
              ))}
            </ul>
          )}

          {purchase.refundable ? (
            refundStep === "confirm" ? (
              <div className="flex flex-wrap items-center gap-tight rounded-field bg-blush p-tight" role="alertdialog" aria-label="Confirm refund">
                <span className="text-body-s text-ink">
                  Refund <Money cents={purchase.pricePaidCents} />? Your download links stop working.
                </span>
                <button
                  type="button"
                  onClick={() => setRefundStep("done")}
                  className="h-11 rounded-chip bg-ink px-loose text-body-s font-medium text-surface"
                >
                  Refund
                </button>
                <button
                  type="button"
                  onClick={() => setRefundStep("idle")}
                  className="h-11 rounded-chip bg-surface px-loose text-body-s font-medium text-ink"
                >
                  Keep it
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-tight">
                <button
                  type="button"
                  onClick={() => setRefundStep("confirm")}
                  className="text-body-s text-ink-2 underline"
                >
                  Refund this purchase
                </button>
                <span className="text-caption text-ink-3">Full refund within 14 days, no questions.</span>
                <NotYetWired stubId="refund" />
              </div>
            )
          ) : (
            <p className="text-caption text-ink-3">The 14-day refund window for this purchase has closed.</p>
          )}
        </>
      )}
    </article>
  );
}
