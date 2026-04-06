import clsx from "clsx";

const variants: Record<string, string> = {
  active: "bg-success/10 text-success",
  completed: "bg-ink-faint/10 text-ink-faint",
  recording: "bg-accent-brown/10 text-accent-brown",
};

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-block rounded border border-rule px-2 py-0.5 font-sans text-xs",
        variants[variant] ?? "bg-parchment-dark text-ink-light",
      )}
    >
      {children}
    </span>
  );
}
