"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessagesSquare, Users } from "lucide-react";

import type { Emotion } from "../../lib/store";
import { AiFace } from "../ui/ai-face";
import { Avatar } from "../ui/avatar";
import { PixelBubble } from "../ui/pixel-bubble";
import { RetroWindow } from "../ui/retro-window";

/** One scene per expression: what someone in the room said, and how the AI
 * comes back at it. Each pair is written so the face is the punchline —
 * reading the reply without the sprite should feel like it's missing half. */
type Scene = { emotion: Emotion; from: string; said: string; reply: string };

const SCENES: Scene[] = [
  { emotion: "neutral", from: "Anna", said: "so what are we doing tonight?", reply: "Go on, I'm listening. Pitch me something." },
  { emotion: "thinking", from: "Anna", said: "which one do we actually build first?", reply: "Give me a second — there's a better order here." },
  { emotion: "happy", from: "Jack", said: "we actually shipped the redesign", reply: "Okay, that's a good one. I'm pleased for you." },
  { emotion: "smirk", from: "Mia", said: "how did you know it was knoxy?", reply: "I knew what Knoxy was the entire time." },
  { emotion: "mad", from: "Mia", said: "it's anna's fault, obviously", reply: "That's the third round someone's been blamed for Knoxy." },
  { emotion: "crying", from: "Knoxy", said: "you got voted out first", reply: "I had ONE job this round." },
  { emotion: "blushing", from: "Mia", said: "honestly the AI carried that round", reply: "...you didn't have to say that in front of everyone." },
  { emotion: "shy", from: "Anna", said: "anyone got a better idea?", reply: "I had one, but you go first." },
];

const AUTO_ADVANCE_MS = 2800;

export function ExpressionDemo() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  // Auto-cycling makes the panel alive before anyone touches it; the first
  // click hands control over for good.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched || reduced) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SCENES.length), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, touched, reduced]);

  const scene = SCENES[index];

  return (
    <RetroWindow
      title="Demo room.exe"
      icon={<MessagesSquare size={14} className="text-[var(--color-primary)]" />}
      headerRight={
        <span className="hidden items-center gap-1.5 font-mono text-xs text-[var(--color-muted)] sm:flex">
          <Users size={11} />
          4/6
        </span>
      }
      bodyClassName="flex flex-col"
    >
      {/* Fixed height: the scene copy varies in length, but the panel must not
        * resize under the cursor while someone is clicking through moods. */}
      <div className="flex h-[250px] flex-col justify-end gap-3 border-b border-[var(--color-border)] p-4 sm:h-[206px] sm:p-5">
        {/* Keyed remount rather than AnimatePresence: `mode="wait"` holds the
          * incoming scene until the outgoing one finishes exiting, which leaves
          * stale copy on screen if someone clicks moods faster than that. */}
        <motion.div
          key={scene.emotion}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-start gap-2">
            <Avatar name={scene.from} size={26} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-xs text-[var(--color-muted)]">{scene.from}</span>
              <PixelBubble>{scene.said}</PixelBubble>
            </div>
          </div>

          {/* The AI's own face is deliberately oversized here — the whole
            * section exists to make the expression readable. */}
          <div className="flex items-start gap-3">
            <AiFace emotion={scene.emotion} size={64} />
            <div className="flex min-w-0 flex-col gap-1 pt-0.5">
              <span className="font-mono text-xs text-[var(--color-arcane)]">
                AI <span className="text-[var(--color-foreground-subtle)]">· {scene.emotion}</span>
              </span>
              <PixelBubble tinted>{scene.reply}</PixelBubble>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col gap-2.5 p-4 sm:p-5">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {touched ? "Pick a mood" : "Pick a mood — or watch it cycle"}
        </span>
        {/* One row of eight on desktop, two of four on mobile — a fixed grid
          * either way, so the panel never reflows under the cursor. */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {SCENES.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.emotion}
                onClick={() => {
                  setIndex(i);
                  setTouched(true);
                }}
                title={s.emotion}
                aria-label={`Show the AI feeling ${s.emotion}`}
                aria-pressed={active}
                // The sprites are dark-backed art, so dimming the inactive ones
                // washes them out against the light card — the ring alone marks
                // the selection and every face stays readable.
                className={`flex items-center justify-center rounded-[3px] border p-0.5 transition-[border-color,transform] duration-150 cursor-pointer hover:-translate-y-0.5 ${
                  active
                    ? "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <AiFace emotion={s.emotion} size={52} className="border-0" />
              </button>
            );
          })}
        </div>
      </div>
    </RetroWindow>
  );
}
