import { useId } from "react";

/** Text field — --surface-sunk fill, field radius, visible focus from globals. */
export function Field({
  label,
  hint,
  error,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-body-s font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint || error ? hintId : undefined}
        aria-invalid={error ? true : undefined}
        className="h-11 rounded-field bg-surface-sunk px-tight text-body text-ink placeholder:text-ink-3 disabled:opacity-50"
        {...rest}
      />
      {error ? (
        <p id={hintId} aria-live="assertive" className="text-body-s text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-body-s text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
