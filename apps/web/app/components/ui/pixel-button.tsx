"use client";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border-[var(--color-primary)] hover:brightness-110",
  secondary:
    "bg-transparent text-[var(--color-foreground)] border-[var(--color-border-strong)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
  ghost:
    "bg-transparent text-[var(--color-muted)] border-transparent hover:text-[var(--color-foreground)] hover:border-[var(--color-border)]",
};

/** The one button primitive for the retro-OS chrome: small radius, a real
 * border (not a soft shadow), and a 1px press-down on :active instead of a
 * scale/glow — mimics a physical pixel button rather than a modern pill. */
export function PixelButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-[3px] border px-4 py-2 font-display text-xs sm:text-sm tracking-wide uppercase transition-[filter,transform,border-color,background-color] duration-150 cursor-pointer active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
