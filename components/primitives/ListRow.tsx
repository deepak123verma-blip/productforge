/** List row — --surface-sunk, 44px icon tile, two-line label. Terminal (no chip). */
export function ListRow({
  icon,
  primary,
  secondary,
  trailing,
}: {
  icon: string;
  primary: string;
  secondary: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-tight rounded-field bg-surface-sunk p-tight">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tile bg-surface">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">{primary}</p>
        <p className="truncate text-body-s text-ink-3">{secondary}</p>
      </div>
      {trailing}
    </div>
  );
}
