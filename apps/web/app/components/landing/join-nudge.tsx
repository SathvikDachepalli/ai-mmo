"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { Emotion } from "../../lib/store";
import { AiFace } from "../ui/ai-face";
import { PixelBubble } from "../ui/pixel-bubble";

/** The AI leaning into the empty space under the join card, cycling through
 * invitations. Passive on purpose — the clickable expression gallery lives
 * further down the page, and two toys competing here would be noise. */
const NUDGES: { emotion: Emotion; line: string }[] = [
  { emotion: "happy", line: "Come in! I saved you a seat." },
  { emotion: "excited", line: "Ooh, a code! Paste it, paste it." },
  { emotion: "shy", line: "...I waited all day. Not that I counted." },
  { emotion: "angry", line: "You've been scrolling for ages. Join already!" },
  { emotion: "smirk", line: "They started without you. Rude of them." },
  { emotion: "blushing", line: "You came back! I mean— hi." },
  { emotion: "neutral", line: "No account. Just a name. Pinky promise." },
];

const CYCLE_MS = 3200;

export function JoinNudge() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % NUDGES.length), CYCLE_MS);
    return () => clearTimeout(timer);
  }, [index, reduced]);

  const nudge = NUDGES[index];

  return (
    // Fixed height so the hero column doesn't shift as lines of different
    // lengths cycle through.
    <div className="flex h-[88px] items-center gap-3 px-1">
      {/* A slow idle bob so it reads as somebody waiting on you rather than a
        * sprite pasted on the page. */}
      <motion.span
        animate={reduced ? undefined : { y: [0, -3, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="shrink-0"
      >
        <AiFace emotion={nudge.emotion} size={56} />
      </motion.span>
      {/* Keyed remount rather than AnimatePresence — no exit gate means the
        * next line is never held back by the previous one leaving. */}
      <motion.div
        key={nudge.emotion}
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
      >
        <PixelBubble tinted>{nudge.line}</PixelBubble>
      </motion.div>
    </div>
  );
}
