"use client";

/** Retro-OS title bar: uppercase ".EXE" title left, minimal controls right.
 * Split out of RetroWindow so a screen can compose a custom header (extra
 * buttons, badges) while keeping the same chrome. */
export function WindowHeader({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="font-display text-xs sm:text-sm tracking-wide uppercase text-[var(--color-foreground)] truncate">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        <WindowControls />
      </div>
    </div>
  );
}

/** The "_ □ ×" cluster — decorative, fixed OS chrome. Not wired to real
 * minimize/maximize/close since these aren't real desktop windows. */
function WindowControls() {
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[var(--color-muted)] font-mono text-xs select-none" aria-hidden>
      <span className="opacity-60">_</span>
      <span className="opacity-60">▢</span>
      <span className="opacity-60">×</span>
    </div>
  );
}
