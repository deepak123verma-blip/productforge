/**
 * The floating surface panel — the ONLY page-level shadowed element
 * (--shadow-panel). r32, no border. Radius drops to 24 under 640px
 * via the responsive class.
 */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full max-w-panel rounded-panel-sm bg-surface p-gap shadow-panel min-[640px]:rounded-panel min-[640px]:p-loose ${className}`}>
      {children}
    </div>
  );
}
