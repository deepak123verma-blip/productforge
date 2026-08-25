/**
 * Shared maps from semantic names to token-backed Tailwind classes.
 * mint=money · butter=products · blush=buyers · lilac=traffic · sky=referrals
 * (never chosen for variety — design-system skill).
 */

export type Pastel = "mint" | "butter" | "blush" | "lilac" | "sky";

export const pastelBg: Record<Pastel, string> = {
  mint: "bg-mint",
  butter: "bg-butter",
  blush: "bg-blush",
  lilac: "bg-lilac",
  sky: "bg-sky",
};

export type AssetFormat = "pdf" | "xlsx" | "zip" | "img" | "link" | "csv";

/** Format tile tints — design spec §5.3. */
export const formatTile: Record<AssetFormat, string> = {
  pdf: "bg-blush",
  xlsx: "bg-mint",
  csv: "bg-mint",
  zip: "bg-butter",
  img: "bg-lilac",
  link: "bg-sky",
};

export type ProductStatus = "draft" | "live" | "under_review" | "restricted";

export const statusChip: Record<ProductStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface-sunk text-ink" },
  live: { label: "Live", className: "bg-mint text-ink" },
  under_review: { label: "Under review", className: "bg-butter text-ink" },
  restricted: { label: "Restricted", className: "bg-blush text-ink" },
};
