import { pastelBg, type Pastel } from "./tokens";

/** Overlapping initial circles; used on feature cards (buyers etc.). */
export function AvatarStack({ names, pastel = "blush" }: { names: string[]; pastel?: Pastel }) {
  return (
    <div className="flex" aria-label={names.join(", ")}>
      {names.slice(0, 4).map((n, i) => (
        <span
          key={n}
          aria-hidden="true"
          className={`flex h-8 w-8 items-center justify-center rounded-chip text-caption font-semibold text-ink ring-2 ring-surface ${pastelBg[pastel]} ${i > 0 ? "-ml-2" : ""}`}
        >
          {n.charAt(0).toUpperCase()}
        </span>
      ))}
      {names.length > 4 && (
        <span aria-hidden="true" className="-ml-2 flex h-8 w-8 items-center justify-center rounded-chip bg-surface-sunk text-caption font-semibold text-ink ring-2 ring-surface">
          +{names.length - 4}
        </span>
      )}
    </div>
  );
}
