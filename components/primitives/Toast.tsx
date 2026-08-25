/**
 * Toast — one of the only two shadowed elements besides the panel
 * (--shadow-lift). aria-live polite; errors use assertive.
 * Static rendering; timing/slide behaviour arrives with real actions.
 */
export function Toast({
  message,
  tone = "default",
}: {
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      role="status"
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`inline-flex items-center gap-tight rounded-card px-gap py-tight shadow-lift ${
        tone === "error" ? "bg-surface text-negative" : "bg-ink text-surface"
      }`}
    >
      <span className="text-body font-medium">{message}</span>
    </div>
  );
}
