import { formatTile, type AssetFormat } from "./tokens";

/**
 * Asset row — --surface-sunk, 44px format tile tinted by type.
 * Drag handle and remove appear on hover; always visible on touch
 * (implemented via group-hover + pointer media query classes).
 */
export function AssetRow({
  title,
  format,
  meta,
  editable = false,
  onRemoveLabel,
}: {
  title: string;
  format: AssetFormat;
  meta: string; // "2.4 MB" or "canva.com"
  editable?: boolean;
  onRemoveLabel?: string;
}) {
  return (
    <div className="group flex items-center gap-tight rounded-field bg-surface-sunk p-tight">
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-tile text-caption font-semibold uppercase text-ink ${formatTile[format]}`}
      >
        {format}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">{title}</p>
        <p className="text-body-s text-ink-3">{meta}</p>
      </div>
      {editable && (
        <div className="flex items-center gap-tight opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
          <button type="button" aria-label={`Reorder ${title}`} className="flex h-11 w-11 cursor-grab items-center justify-center text-ink-2">
            ⠿
          </button>
          <button type="button" aria-label={onRemoveLabel ?? `Remove ${title}`} className="flex h-11 w-11 items-center justify-center text-ink-2">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
