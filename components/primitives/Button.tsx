import Link from "next/link";

/**
 * Primary: --ink fill, white text, chip radius, 44px.
 * Secondary: --surface-sunk fill, ink text.
 */
const styles = {
  primary: "bg-ink text-surface",
  secondary: "bg-surface-sunk text-ink",
} as const;

const base =
  "inline-flex h-11 items-center justify-center rounded-chip px-loose text-body font-medium disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "primary",
  href,
  children,
  ...rest
}: {
  variant?: keyof typeof styles;
  href?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${base} ${styles[variant]}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
