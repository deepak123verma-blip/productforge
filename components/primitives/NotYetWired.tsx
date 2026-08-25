import { stubMessage } from "../../lib/stubs/registry";

/**
 * The single honest-stub treatment. --sky per the semantic palette
 * (system/informational). Names the blocking service; the registry at
 * lib/stubs/registry.ts is the source of truth and /kitchen-sink/stubs
 * shows the remaining surface area.
 */
export function NotYetWired({ stubId, className = "" }: { stubId: string; className?: string }) {
  return (
    <p className={`inline-flex items-center gap-tight rounded-field bg-sky px-tight py-1 text-body-s text-ink-2 ${className}`}>
      <span aria-hidden="true">◌</span>
      {stubMessage(stubId)}
    </p>
  );
}
