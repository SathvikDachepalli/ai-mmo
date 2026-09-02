"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Users } from "lucide-react";

import type { Emotion } from "../../lib/store";
import { AiFace } from "../ui/ai-face";
import { Avatar } from "../ui/avatar";
import { PixelBubble } from "../ui/pixel-bubble";
import { RetroWindow } from "../ui/retro-window";

/* A room that actually plays, rather than a screenshot of one. Everything the
 * real client does on a socket event — someone knocking and being let in, a
 * typing indicator, the AI composing before it speaks — happens here on a
 * timer instead. Used at two scales: a compact preview in the hero and the
 * full-width centrepiece. */

export type RoomEvent =
  | { kind: "join"; who: string }
  | { kind: "msg"; who: string; text: string }
  | { kind: "ai"; text: string; emotion: Emotion };

/** How long each event's "composing" phase runs before the event lands. Joins
 * have no compose phase — someone appears the moment the host lets them in. */
function composeMs(event: RoomEvent): number {
  if (event.kind === "join") return 0;
  // The AI still gets the longer beat -- its pause before answering is the
  // point -- but the whole sequence is paced for someone who will give this
  // a few seconds, not fifteen.
  return event.kind === "ai" ? 1000 : 550;
}

/** Beat after an event lands, before the next one starts composing. */
function settleMs(event: RoomEvent): number {
  return event.kind === "join" ? 500 : 850;
}

export function LiveRoom({
  title,
  events,
  bodyHeight,
  startingPresence,
  capacity = 6,
  loop = false,
  startAt = 0,
  className = "",
}: {
  title: string;
  events: RoomEvent[];
  /** Tailwind height classes. A looping room needs a hard `h-` (it resets, so
   *  it must not resize); a play-once room takes `min-h-`. Either way the log
   *  scrolls rather than clipping, so a bad height guess on a narrow screen
   *  costs a scrollbar instead of a hidden message. */
  bodyHeight: string;
  startingPresence: number;
  capacity?: number;
  loop?: boolean;
  /** Events before this index are already on screen when playback starts, so
   *  the room opens mid-conversation instead of empty. Keeps the AI's turn
   *  seconds away rather than the far end of a long build-up. */
  startAt?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: !loop, margin: "-100px" });

  // `played` is how far the timeline has advanced; `composing` means the next
  // event's author is typing (or the AI is thinking).
  const [played, setPlayed] = useState(startAt);
  const [composing, setComposing] = useState(false);

  // Derived rather than seeded into state: `useReducedMotion` can resolve to
  // true only after hydration, and a `useState` initializer never re-runs —
  // which would strand those users looking at an empty room.
  const shown = reduced ? events.length : played;

  useEffect(() => {
    if (reduced || !inView) return;

    if (shown >= events.length) {
      if (!loop) return;
      // Restart from the seeded state, not from nothing: resetting to an
      // empty log flashes a blank room between cycles.
      const timer = setTimeout(() => setPlayed(startAt), 3400);
      return () => clearTimeout(timer);
    }

    const next = events[shown];
    if (!composing && composeMs(next) > 0) {
      const timer = setTimeout(() => setComposing(true), shown === 0 ? 300 : settleMs(events[shown - 1]));
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(
      () => {
        setPlayed((n) => n + 1);
        setComposing(false);
      },
      composeMs(next) || (shown === 0 ? 300 : settleMs(events[shown - 1]))
    );
    return () => clearTimeout(timer);
  }, [inView, shown, composing, events, loop, reduced, startAt]);

  const landed = events.slice(0, shown);
  const pending = shown < events.length ? events[shown] : null;
  const presence = startingPresence + landed.filter((e) => e.kind === "join").length;

  return (
    <div ref={ref} className={className}>
      <RetroWindow
        title={title}
        icon={<span className="h-2 w-2 rounded-full bg-[var(--color-success)]" aria-hidden />}
        headerRight={
          <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--color-muted)]">
            <Users size={11} />
            <motion.span key={presence} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}>
              {presence}
            </motion.span>
            /{capacity}
          </span>
        }
        bodyClassName={`ember-scroll flex flex-col gap-3 overflow-y-auto p-4 sm:p-5 ${bodyHeight}`}
      >
        {landed.map((event, i) => (
          <RoomLine key={`${i}-${eventKey(event)}`} event={event} />
        ))}

        {/* Reserved row so a landing message never shoves the log upward. */}
        <div className="flex h-6 items-center">
          {composing && pending ? <Composing event={pending} /> : null}
        </div>
      </RetroWindow>
    </div>
  );
}

function eventKey(event: RoomEvent): string {
  return event.kind === "join" ? `join-${event.who}` : `${event.kind}-${event.text.slice(0, 24)}`;
}

function RoomLine({ event }: { event: RoomEvent }) {
  if (event.kind === "join") {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="font-mono text-xs text-[var(--color-foreground-subtle)]"
      >
        <span className="text-[var(--color-success)]">+</span> {event.who} joined the room.
      </motion.p>
    );
  }

  const isAi = event.kind === "ai";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-start gap-2.5"
    >
      {isAi ? <AiFace emotion={event.emotion} size={34} /> : <Avatar name={event.who} size={34} />}
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={`font-mono text-xs ${
            isAi ? "text-[var(--color-arcane)]" : "text-[var(--color-muted)]"
          }`}
        >
          {isAi ? "AI" : event.who}
        </span>
        <PixelBubble tinted={isAi}>{event.text}</PixelBubble>
      </div>
    </motion.div>
  );
}

/** Typing dots for a person; a distinct "thinking" state for the AI, because
 * the pause before it answers is the thing worth showing. */
function Composing({ event }: { event: RoomEvent }) {
  if (event.kind === "join") return null;
  const isAi = event.kind === "ai";

  return (
    <div
      className={`flex items-center gap-2 font-mono text-xs ${
        isAi ? "text-[var(--color-arcane)]" : "pl-1 text-[var(--color-foreground-subtle)]"
      }`}
    >
      {/* The AI shows its face while composing, so the room never looks like
        * it has no AI in it -- the whole claim of the page. */}
      {isAi ? <AiFace emotion="thinking" size={22} /> : null}
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              isAi ? "bg-[var(--color-arcane)]" : "bg-[var(--color-muted)]"
            }`}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </span>
      {isAi ? "AI is thinking…" : `${event.who} is typing…`}
    </div>
  );
}
