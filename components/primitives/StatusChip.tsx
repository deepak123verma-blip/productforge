import { statusChip, type ProductStatus } from "./tokens";

export function StatusChip({ status }: { status: ProductStatus }) {
  const s = statusChip[status];
  return (
    <span className={`inline-flex items-center rounded-chip px-3 py-1 text-caption font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
