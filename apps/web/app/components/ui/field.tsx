"use client";

/** Icon + label above a form control. The one form-row primitive, so every
 * input across auth, join, and settings lines up identically. */
export function Field({
  icon,
  label,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
