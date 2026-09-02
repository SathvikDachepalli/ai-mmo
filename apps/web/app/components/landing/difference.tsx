"use client";

import { motion, useReducedMotion } from "framer-motion";

import { AiFace } from "../ui/ai-face";
import { Avatar } from "../ui/avatar";

/* The objection this page has to answer: "why not just open an AI chatbot?"
 * Answered structurally rather than as a competitor comparison — one column
 * has a single line into the AI, the other has four. No brand is named. */

const ROOM_MEMBERS = ["Anna", "Jack", "Knoxy", "Mia"];

export function Difference() {
  const reduced = useReducedMotion();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Left: one person, one private line. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex flex-col gap-5 rounded-[6px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/40 p-6"
      >
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          One person + AI
        </span>

        <div className="flex min-h-[132px] items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name="You" size={38} />
            <span className="font-mono text-xs text-[var(--color-muted)]">You</span>
          </div>
          <span aria-hidden className="h-px w-10 bg-[var(--color-border-strong)] sm:w-14" />
          <div className="flex flex-col items-center gap-1.5">
            <AiFace emotion="neutral" size={38} />
            <span className="font-mono text-xs text-[var(--color-muted)]">AI</span>
          </div>
        </div>

        <p className="body-copy-sm">
          You ask, it answers. Everything it said lives in your window — so anyone else has to be told
          about it secondhand.
        </p>
      </motion.div>

      {/* Right: four people, one shared line into the same room. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
        className="flex flex-col gap-5 rounded-[6px] border border-[var(--color-primary)]/45 bg-[var(--color-surface)] p-6"
      >
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-primary)]">
          Everyone + AI
        </span>

        <div className="flex min-h-[132px] items-center justify-center gap-3">
          <ul className="flex flex-col gap-1.5">
            {ROOM_MEMBERS.map((name, i) => (
              <motion.li
                key={name}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: 0.2 + i * 0.08, ease: "easeOut" }}
                className="flex items-center gap-2"
              >
                <Avatar name={name} size={26} />
                <span className="font-mono text-xs text-[var(--color-muted)]">{name}</span>
              </motion.li>
            ))}
          </ul>

          {/* Four lines converging into one — the whole argument of the page,
            * drawn. Decorative, so it's hidden from the accessibility tree. */}
          <svg
            aria-hidden
            viewBox="0 0 56 132"
            className="h-[132px] w-12 shrink-0 text-[var(--color-primary)]"
            fill="none"
          >
            {[18, 51, 84, 117].map((y, i) => (
              <motion.path
                key={y}
                d={`M0 ${y} H22 Q34 ${y} 34 66 H56`}
                stroke="currentColor"
                strokeWidth="1.5"
                initial={reduced ? undefined : { pathLength: 0, opacity: 0 }}
                whileInView={reduced ? undefined : { pathLength: 1, opacity: 0.8 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: 0.35 + i * 0.08, ease: "easeOut" }}
              />
            ))}
          </svg>

          <div className="flex flex-col items-center gap-1.5">
            <AiFace emotion="happy" size={44} />
            <span className="font-mono text-xs text-[var(--color-arcane)]">AI</span>
          </div>
        </div>

        <p className="body-copy-sm">
          Everyone talks, the AI hears all of it, and its answer lands in front of the whole room at
          once. Nobody gets briefed later.
        </p>
      </motion.div>
    </div>
  );
}
