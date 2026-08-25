"use client";

/** Small presence dot — online (filled mint) or offline (hollow/dim). Used
 * anywhere a player/connection state needs a glance-able marker instead of
 * repeating the same two Tailwind classes at each call site. */
export function StatusIndicator({
  online,
  size = 8,
  className = "",
}: {
  online: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full border ${className}`}
      style={{
        width: size,
        height: size,
        background: online ? "var(--color-primary)" : "transparent",
        borderColor: online ? "var(--color-primary)" : "var(--color-border-strong)",
      }}
      aria-label={online ? "online" : "offline"}
    />
  );
}
