"use client";

/** Initial-in-a-square avatar. The color is derived from the name so the
 * same person keeps the same tile everywhere without storing anything. */

// Muted variants of the palette's two hues (mint, accent) instead of bright
// rainbow tags — keeps per-user distinction without breaking the "not overly
// colorful" rule.
const AVATAR_PALETTE = [
  "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/40",
  "bg-[var(--color-muted)]/20 text-[var(--color-muted)] border-[var(--color-muted)]/40",
  "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/40",
  "bg-[var(--color-foreground-subtle)]/20 text-[var(--color-foreground-subtle)] border-[var(--color-foreground-subtle)]/40",
  "bg-[var(--color-ember)]/20 text-[var(--color-ember)] border-[var(--color-ember)]/40",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const palette = AVATAR_PALETTE[hashName(name || "?") % AVATAR_PALETTE.length];
  return (
    <span
      className={`flex items-center justify-center rounded-[3px] border font-display font-semibold shrink-0 ${palette}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
