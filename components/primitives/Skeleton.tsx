/** Loading is --surface-sunk skeleton shimmer, never a spinner. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-field ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="flex h-stat-card flex-col justify-between rounded-card bg-surface-sunk p-gap">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}
