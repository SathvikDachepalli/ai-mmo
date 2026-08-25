"use client";

export type ChatFont = "poppins" | "pixelify";

const KEY = "meetpoint-chat-font";

export function getStoredChatFont(): ChatFont {
  if (typeof window === "undefined") return "poppins";
  const v = window.localStorage.getItem(KEY);
  return v === "pixelify" ? "pixelify" : "poppins";
}

export function applyChatFont(font: ChatFont): void {
  if (typeof document === "undefined") return;
  if (font === "pixelify") {
    document.documentElement.setAttribute("data-chat-font", "pixelify");
  } else {
    document.documentElement.removeAttribute("data-chat-font");
  }
  window.localStorage.setItem(KEY, font);
}

export function toggleChatFont(current: ChatFont): ChatFont {
  const next: ChatFont = current === "poppins" ? "pixelify" : "poppins";
  applyChatFont(next);
  return next;
}
