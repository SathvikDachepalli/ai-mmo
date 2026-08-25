"use client";

export type Theme = "light" | "dark" | "system";

const KEY = "meetpoint-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.removeItem(KEY);
  } else {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(KEY, theme);
  }
}

/** Cycles light -> dark -> system -> light, applying and persisting each step. */
export function cycleTheme(current: Theme): Theme {
  const next: Theme = current === "light" ? "dark" : current === "dark" ? "system" : "light";
  applyTheme(next);
  return next;
}
