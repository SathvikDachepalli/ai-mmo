import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meetpoint — Collaborative AI Chat Rooms",
  description:
    "Open a shared chat room with a code. Friends join with a name, ideas stay in one thread, and an AI participant thinks alongside you.",
};

// Sets data-theme on <html> before paint, from the saved preference — avoids
// a flash of the wrong theme that a client-only useEffect couldn't prevent.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem("meetpoint-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    var chatFont = localStorage.getItem("meetpoint-chat-font");
    if (chatFont === "pixelify") {
      document.documentElement.setAttribute("data-chat-font", "pixelify");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <div className="crt-overlay" aria-hidden />
        <div className="relative z-[1] flex flex-col min-h-full">{children}</div>
      </body>
    </html>
  );
}
