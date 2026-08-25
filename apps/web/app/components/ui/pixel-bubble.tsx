"use client";

/** A pixel-art speech bubble: stepped/notched corners and a blocky tail
 * instead of a rounded modern chat bubble. `side` mirrors the tail — "left"
 * for other people's messages, "right" for your own. */
export function PixelBubble({
  side = "left",
  tinted = false,
  className = "",
  children,
}: {
  side?: "left" | "right";
  tinted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`pixel-bubble ${tinted ? "pixel-bubble-tint" : ""} ${className}`} data-side={side}>
      <span className="pixel-bubble-fill block font-body text-sm leading-relaxed">{children}</span>
      <span className="pixel-bubble-tail" aria-hidden />
      <span className="pixel-bubble-dot" aria-hidden />
    </span>
  );
}
