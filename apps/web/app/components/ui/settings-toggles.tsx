"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Type } from "lucide-react";

import { cycleTheme, getStoredTheme, type Theme } from "../../lib/theme";
import { getStoredChatFont, toggleChatFont, type ChatFont } from "../../lib/font";

/* The two always-paired settings controls. They live together because every
 * screen renders them as a pair in the same corner. */

const THEME_ICONS: Record<Theme, React.ComponentType<{ size?: number }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const TOGGLE_CLASSES =
  "flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-[3px] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border-strong)] transition-colors duration-150 cursor-pointer";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const Icon = THEME_ICONS[theme];

  return (
    <button
      onClick={() => setTheme(cycleTheme(theme))}
      title={`Theme: ${THEME_LABELS[theme]} (click to change)`}
      aria-label="Change theme"
      className={`${TOGGLE_CLASSES} ${className}`}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
    </button>
  );
}

const CHAT_FONT_LABELS: Record<ChatFont, string> = {
  poppins: "Poppins",
  pixelify: "Pixelify",
};

/** Settings control: switches the font used for chat bubbles / AI narration
 * between Poppins (default, easier long-read body copy) and Pixelify Sans
 * (matches the window chrome, which never changes). Window titles, labels,
 * and buttons always stay Pixelify regardless of this setting. */
export function ChatFontToggle({ className = "" }: { className?: string }) {
  const [font, setFont] = useState<ChatFont>("poppins");

  useEffect(() => {
    setFont(getStoredChatFont());
  }, []);

  return (
    <button
      onClick={() => setFont(toggleChatFont(font))}
      title={`Chat font: ${CHAT_FONT_LABELS[font]} (click to change)`}
      aria-label="Change chat font"
      className={`${TOGGLE_CLASSES} ${className}`}
    >
      <Type size={14} />
      <span className="hidden sm:inline">{CHAT_FONT_LABELS[font]}</span>
    </button>
  );
}
