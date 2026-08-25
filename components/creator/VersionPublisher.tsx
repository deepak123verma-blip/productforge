"use client";

import { useState } from "react";
import { NotYetWired } from "../primitives/NotYetWired";

/**
 * Publish-a-new-version flow (PRD §6.5): changelog entry + a preview of
 * the email every past buyer receives. The persist + send are stubbed
 * (registry: "version-publish"); everything up to that point is real.
 */
export function VersionPublisher({
  productTitle,
  currentVersion,
  buyerCount,
}: {
  productTitle: string;
  currentVersion: number;
  buyerCount: number;
}) {
  const [changelog, setChangelog] = useState("");
  const [staged, setStaged] = useState(false);
  const nextVersion = currentVersion + 1;

  return (
    <section aria-label="Publish a new version" className="flex flex-col gap-tight rounded-card bg-surface-sunk p-gap">
      <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">
        Publish a new version
      </h2>
      <p className="text-body-s text-ink-2">
        Version {nextVersion} goes to all {buyerCount} past buyers free, with your changelog and a fresh access link.
      </p>

      {staged ? (
        <p className="rounded-field bg-mint p-tight text-body-s text-ink" aria-live="polite">
          <strong>Version {nextVersion} drafted.</strong> It publishes — and the email below goes out — once the live
          services are connected.
        </p>
      ) : (
        <>
          <label htmlFor="changelog" className="text-body-s font-medium text-ink">
            What changed?
          </label>
          <textarea
            id="changelog"
            rows={3}
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="Added 20 new hooks and refreshed the calendar."
            className="rounded-field bg-surface p-tight text-body text-ink placeholder:text-ink-3"
          />
        </>
      )}

      {changelog.trim() && (
        <div className="rounded-field bg-surface p-tight" aria-label="Buyer email preview">
          <p className="text-caption font-semibold uppercase tracking-[0.04em] text-ink-3">Email preview</p>
          <p className="mt-1 text-body-s text-ink">
            <strong>{productTitle} just got better.</strong>
          </p>
          <p className="text-body-s text-ink-2">{changelog}</p>
          <p className="mt-1 text-body-s text-ink-2">Your download link below always has the latest version.</p>
          <span className="mt-1 inline-flex h-8 items-center rounded-chip bg-ink px-tight text-caption font-medium text-surface">
            Get version {nextVersion}
          </span>
        </div>
      )}

      {!staged && (
        <div className="flex items-center gap-tight">
          <button
            type="button"
            disabled={!changelog.trim()}
            onClick={() => setStaged(true)}
            className="h-11 rounded-chip bg-ink px-loose text-body font-medium text-surface disabled:pointer-events-none disabled:opacity-50"
          >
            Publish version {nextVersion}
          </button>
          <NotYetWired stubId="version-publish" />
        </div>
      )}
    </section>
  );
}
