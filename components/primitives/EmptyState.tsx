import { Button } from "./Button";
import { pastelBg, type Pastel } from "./tokens";

/** Pastel card, one line naming what goes here, one action. No illustration, no apology. */
export function EmptyState({
  title,
  line,
  actionLabel,
  actionHref,
  pastel = "butter",
}: {
  title: string;
  line: string;
  actionLabel: string;
  actionHref: string;
  pastel?: Pastel;
}) {
  return (
    <div className={`flex flex-col items-start gap-tight rounded-card p-loose ${pastelBg[pastel]}`}>
      <h3 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="text-body text-ink-2">{line}</p>
      <Button href={actionHref}>{actionLabel}</Button>
    </div>
  );
}
