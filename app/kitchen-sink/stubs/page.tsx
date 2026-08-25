import Link from "next/link";
import { Panel } from "../../../components/primitives/Panel";
import { serviceLabel, stubRegistry } from "../../../lib/stubs/registry";

/** The remaining offline surface area — empties out as Phase 2+ services come online. */
export default function StubsPage() {
  return (
    <main className="flex min-h-screen justify-center p-loose">
      <Panel>
        <h1 className="mb-tight font-display text-display-l font-bold tracking-[-0.02em] text-ink">
          Stub registry
        </h1>
        <p className="mb-gap text-body text-ink-2">
          {stubRegistry.length} surfaces wait on external services. Phase 2 progress is this table emptying.{" "}
          <Link href="/kitchen-sink" className="underline">Back to the kitchen sink</Link>.
        </p>
        <div className="overflow-x-auto rounded-card">
          <table className="w-full border-collapse text-body-s">
            <caption className="sr-only">Stubbed surfaces</caption>
            <thead>
              <tr>
                {["Surface", "Wired action", "Blocked on", "Clears in", "Logic"].map((h) => (
                  <th key={h} scope="col" className="border-b border-hairline px-tight py-tight text-left text-caption font-semibold uppercase tracking-[0.04em] text-ink-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stubRegistry.map((s) => (
                <tr key={s.id} className="border-b border-hairline">
                  <td className="px-tight py-tight font-medium text-ink">{s.surface}</td>
                  <td className="px-tight py-tight text-ink-2">{s.action}</td>
                  <td className="px-tight py-tight">
                    <span className="rounded-chip bg-sky px-tight py-1 text-caption text-ink">
                      {s.blockedOn.map((b) => serviceLabel[b]).join(" + ")}
                    </span>
                  </td>
                  <td className="px-tight py-tight">Phase {s.clearsInPhase}</td>
                  <td className="px-tight py-tight">
                    <span className={`rounded-chip px-tight py-1 text-caption ${s.status === "unwired" ? "bg-mint text-ink" : "bg-surface-sunk text-ink-2"}`}>
                      {s.status === "unwired" ? "written, unwired" : "unwritten"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}
