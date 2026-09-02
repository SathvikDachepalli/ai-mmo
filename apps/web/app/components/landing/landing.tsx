"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Ban,
  Hash,
  KeyRound,
  MessagesSquare,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";

import { AiFace } from "../ui/ai-face";
import { Avatar } from "../ui/avatar";
import { PixelButton } from "../ui/pixel-button";
import { RetroWindow } from "../ui/retro-window";
import { ChatFontToggle, ThemeToggle } from "../ui/settings-toggles";
import { AccessCard } from "./access-card";
import { Difference } from "./difference";
import { JoinNudge } from "./join-nudge";
import { LiveRoom, type RoomEvent } from "./live-room";
import { ExpressionDemo } from "./expression-demo";

/** Shared scroll-reveal. Every section below the fold uses the same rise so
 * the page reads as one motion system instead of a pile of effects. */
const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

type AccessTab = "join" | "host";
type HeroPanel = "room" | "access";

export function Landing({
  onGuestReady,
  onHostAuthed,
}: {
  onGuestReady: (code: string, displayName: string) => void;
  onHostAuthed: () => void;
}) {
  // The hero's right column shows a room playing by default and flips to the
  // sign-in / join form when a CTA is pressed — anywhere on the page.
  const [panel, setPanel] = useState<HeroPanel>("room");
  const [tab, setTab] = useState<AccessTab>("join");
  const panelRef = useRef<HTMLDivElement>(null);

  const openAccess = (next: AccessTab) => {
    setTab(next);
    setPanel("access");
    // `nearest` is a no-op when the panel is already on screen (desktop) and
    // scrolls it into view when it is stacked below the copy (mobile).
    requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[var(--color-background)] text-[var(--color-foreground)]">
      <TopNav />
      <Hero
        panel={panel}
        tab={tab}
        panelRef={panelRef}
        onTabChange={setTab}
        onShowRoom={() => setPanel("room")}
        onOpenRoom={() => openAccess("host")}
        onJoinCode={() => openAccess("join")}
        onGuestReady={onGuestReady}
        onHostAuthed={onHostAuthed}
      />
      <ThreadSection />
      <DifferenceSection />
      <ExpressionSection />
      <WhySection />
      <HowItWorks />
      <HostControls />
      <FinalCta onOpenRoom={() => openAccess("host")} onJoinCode={() => openAccess("join")} />
      <Footer />
    </div>
  );
}

/* -------------------------------- Chrome -------------------------------- */

const NAV_LINKS = [
  { href: "#thread", label: "The room" },
  { href: "#difference", label: "Why not a chatbot" },
  { href: "#expressions", label: "The AI" },
  { href: "#why", label: "What it's for" },
  { href: "#rules", label: "Host controls" },
];

function TopNav() {
  return (
    <header className="relative z-30 border-b border-[var(--color-border)]/70 bg-[var(--color-background)]/70 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <span className="flex items-center gap-2">
          <MessagesSquare size={16} className="text-[var(--color-primary)]" />
          <span className="font-display text-sm tracking-wide uppercase">Meetpoint.exe</span>
        </span>
        <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors duration-150 hover:text-[var(--color-foreground)]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ChatFontToggle />
        </div>
      </div>
    </header>
  );
}

/* --------------------------------- Hero --------------------------------- */

/** The two human lines are seeded (see `startAt`), so the hero opens on a room
 * already mid-argument and the only thing that animates is the AI thinking and
 * answering. That is the claim of the page, so it should not be six seconds of
 * build-up away. */
const HERO_EVENTS: RoomEvent[] = [
  { kind: "msg", who: "Anna", text: "ok so are we shipping friday or not" },
  { kind: "msg", who: "Jack", text: "friday works for me" },
  { kind: "ai", text: "Friday it is — with the new onboarding as the last thing in scope.", emotion: "happy" },
];
const HERO_SEEDED = 2;

function Hero({
  panel,
  tab,
  panelRef,
  onTabChange,
  onShowRoom,
  onOpenRoom,
  onJoinCode,
  onGuestReady,
  onHostAuthed,
}: {
  panel: HeroPanel;
  tab: AccessTab;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onTabChange: (tab: AccessTab) => void;
  onShowRoom: () => void;
  onOpenRoom: () => void;
  onJoinCode: () => void;
  onGuestReady: (code: string, displayName: string) => void;
  onHostAuthed: () => void;
}) {
  return (
    <section className="relative mx-auto grid w-full max-w-6xl items-start gap-10 px-6 pt-12 pb-20 lg:grid-cols-[1.05fr_minmax(360px,420px)] lg:gap-14 lg:pt-16">
      <div className="flex flex-col gap-6">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="eyebrow"
        >
          Collaborative AI chat rooms
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
          className="font-display text-[2.6rem] font-bold leading-[1.03] tracking-wide sm:text-5xl lg:text-6xl"
        >
          Think out loud.
          <br />
          <span className="text-[var(--color-primary)]">Together, with an AI in the room.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
          className="body-copy"
        >
          One room, one code, everyone talking in the same thread — and an AI that&apos;s already in it,
          reading along and speaking up when it has something worth adding.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18, ease: "easeOut" }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap gap-3">
            <PixelButton onClick={onOpenRoom} className="px-6 py-3.5 text-sm">
              Open a room
              <ArrowRight size={16} />
            </PixelButton>
            <PixelButton variant="secondary" onClick={onJoinCode} className="px-6 py-3.5 text-sm">
              <Hash size={15} />
              Join with a code
            </PixelButton>
          </div>
          <p className="body-copy-sm">
            Joining takes a name and a six-character code — no account, nothing to install.{" "}
            <span className="text-[var(--color-muted)]">Hosts sign in once.</span>
          </p>
        </motion.div>
      </div>

      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="flex w-full flex-col gap-4 lg:sticky lg:top-20 lg:min-h-[470px]"
      >
        {/* Keyed remount, not AnimatePresence: `mode="wait"` holds the incoming
          * panel until the outgoing one finishes exiting, so a CTA press can
          * leave the old panel on screen. The swap has to be instant. */}
        {panel === "room" ? (
            <motion.div
              key="room"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              <LiveRoom
                title="Friday scope.exe"
                events={HERO_EVENTS}
                startingPresence={3}
                startAt={HERO_SEEDED}
                bodyHeight="h-[360px] sm:h-[320px]"
                loop
              />
              <p className="px-1 font-mono text-xs text-[var(--color-foreground-subtle)]">
                A room, mid-conversation. The AI is a member, not a sidebar.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="access"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              <AccessCard
                tab={tab}
                onTabChange={onTabChange}
                onGuestReady={onGuestReady}
                onHostAuthed={onHostAuthed}
              />
              <div className="flex items-start justify-between gap-3">
                <JoinNudge />
                <button
                  onClick={onShowRoom}
                  className="shrink-0 pt-2 font-mono text-xs text-[var(--color-muted)] underline decoration-dotted underline-offset-4 transition-colors duration-150 hover:text-[var(--color-foreground)] cursor-pointer"
                >
                  ← See a room
                </button>
              </div>
            </motion.div>
          )}
      </motion.div>
    </section>
  );
}

/* ----------------------------- Thread centrepiece ------------------------- */

/** The page's one deliberate break from the two-column rhythm: a full-width
 * room where the conversation plays out, including someone arriving late and
 * being caught up by the AI — which is the whole pitch in one exchange. */
const THREAD_EVENTS: RoomEvent[] = [
  { kind: "msg", who: "Anna", text: "what if onboarding was just one screen?" },
  { kind: "msg", who: "Jack", text: "people would still bounce at the email step" },
  // ^ seeded; everything below animates.
  {
    kind: "ai",
    text: "Then move email after the first win — let them see the product work before you ask for anything.",
    emotion: "thinking",
  },
  { kind: "join", who: "Knoxy" },
  { kind: "msg", who: "Knoxy", text: "sorry, late — what did we land on?" },
  {
    kind: "ai",
    text: "One screen, email moved after the first win. Anna proposed it, Jack flagged the drop-off.",
    emotion: "neutral",
  },
  { kind: "msg", who: "Knoxy", text: "ok that's the version i'd actually ship" },
];

function ThreadSection() {
  return (
    <section id="thread" className="relative border-t border-[var(--color-border)]/70 bg-[var(--color-surface)]/30">
      <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
        <motion.div {...reveal} className="flex flex-col items-center gap-5 text-center">
          <span className="eyebrow">The room</span>
          <h2 className="font-display text-[2.4rem] font-bold leading-[1.05] tracking-wide sm:text-5xl lg:text-[3.5rem]">
            One thread.
            <br />
            <span className="text-[var(--color-primary)]">Everyone in it.</span>
          </h2>
          <p className="body-copy text-center">
            Watch what happens when the AI is a participant instead of a separate window — including the
            part where someone shows up late.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="mt-12"
        >
          <LiveRoom
            title="Onboarding rewrite.exe"
            events={THREAD_EVENTS}
            startingPresence={2}
            startAt={2}
            bodyHeight="min-h-[540px] sm:min-h-[500px]"
          />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------- Difference ------------------------------- */

function DifferenceSection() {
  return (
    <section id="difference" className="relative border-t border-[var(--color-border)]/70">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <motion.div {...reveal} className="flex max-w-2xl flex-col gap-4">
          <span className="eyebrow">Why not just a chatbot</span>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
            An AI in the room, not in your window.
          </h2>
          <p className="body-copy">
            Most AI chat is one person and a model, in private. Everything useful it says has to be
            copy-pasted to everyone else. Meetpoint puts the model inside the conversation your group is
            already having.
          </p>
        </motion.div>

        <div className="mt-12">
          <Difference />
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Expression showcase -------------------------- */

function ExpressionSection() {
  return (
    <section
      id="expressions"
      className="relative border-t border-[var(--color-border)]/70 bg-[var(--color-surface)]/30"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1fr] lg:items-center lg:gap-14">
        <motion.div {...reveal} className="flex flex-col gap-4">
          <span className="eyebrow">Expressive AI</span>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
            It doesn&apos;t just reply. It reacts.
          </h2>
          <p className="body-copy">
            It picks a face from whatever it&apos;s about to say, so you can read the room&apos;s fourth
            member the way you read everyone else — smug, stung, or too pleased with itself to hide it.
          </p>
          <p className="body-copy-sm">
            In a real room it chooses its own. Here, pick a mood and see what it does with it.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
        >
          <ExpressionDemo />
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------- Why band ------------------------------- */

/** Situations rather than features — each one is a sentence somebody has
 * actually said in a group chat. */
const SITUATIONS = [
  {
    quote: "Wait — what did we decide?",
    body:
      "Someone drops in an hour late. Instead of scrolling back through everything, they just ask, and the AI recaps what the room landed on and who pushed for what.",
  },
  {
    quote: "Nobody wants to host.",
    body:
      "Werewolf, trivia, twenty questions. The AI runs the round and keeps track of who's out, so the person who knows the rules gets to actually play for once.",
  },
  {
    quote: "We're going in circles.",
    body:
      "Two people have been saying the same thing in different words for ten minutes. The AI names the actual disagreement out loud and the room finally moves.",
  },
];

function WhySection() {
  return (
    <section id="why" className="relative border-t border-[var(--color-border)]/70">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <motion.div {...reveal} className="flex max-w-2xl flex-col gap-4">
          <span className="eyebrow">What it&apos;s for</span>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
            You already know these moments.
          </h2>
          <p className="body-copy">
            Meetpoint isn&apos;t a place to talk <em>to</em> an AI on your own. It&apos;s the room your
            people are already in — and the AI is one more voice in it that knows whose room it is.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {SITUATIONS.map((situation, i) => (
            <motion.article
              key={situation.quote}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: "easeOut" }}
              whileHover={{ y: -4 }}
              className="flex flex-col gap-4 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors duration-200 hover:border-[var(--color-primary)]/50"
            >
              <h3 className="font-display text-xl leading-snug tracking-wide text-[var(--color-foreground)]">
                &ldquo;{situation.quote}&rdquo;
              </h3>
              <p className="body-copy-sm">{situation.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ How it works ----------------------------- */

const STEPS = [
  {
    title: "Open a room",
    body: "Sign in once, name the room, and you get a six-character code.",
  },
  {
    title: "Share the code",
    body: "Everyone who wants in knocks. You see their name and decide, one by one.",
  },
  {
    title: "Talk — it's already listening",
    body:
      "No slash command, no @mention, no prompt box. It reads the room and speaks when it has something worth adding.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-[var(--color-border)]/70 bg-[var(--color-surface)]/30">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <motion.div {...reveal} className="flex max-w-2xl flex-col gap-4">
          <span className="eyebrow">How it works</span>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
            Three steps, no onboarding.
          </h2>
        </motion.div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            // The third step is the differentiator, so it gets the weight.
            const isLast = i === STEPS.length - 1;
            return (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.1, ease: "easeOut" }}
                className={`relative flex flex-col gap-2 rounded-[6px] border-t-2 p-5 ${
                  isLast
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.07]"
                    : "border-[var(--color-primary)]/25"
                }`}
              >
                <span className="font-mono text-xs text-[var(--color-primary)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-lg tracking-wide">{step.title}</h3>
                <p className="body-copy-sm">{step.body}</p>
                {isLast ? (
                  <span className="mt-1 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-[var(--color-primary)]">
                    <Sparkles size={12} />
                    That&apos;s the whole trick
                  </span>
                ) : null}
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------ Host controls ---------------------------- */

/** Real controls with their real state showing, rather than a bulleted feature
 * list. Every value here matches what the host actually sees in the app: the
 * knock queue, the room's AI rules, the model list from the picker, the cap. */
const MODELS = ["DeepSeek", "Llama", "Gemini", "Claude", "GPT"];

function HostControls() {
  return (
    <section id="rules" className="relative border-t border-[var(--color-border)]/70">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:gap-16">
        <motion.div {...reveal} className="flex flex-col gap-4">
          <span className="eyebrow">Host controls</span>
          <h2 className="font-display text-3xl font-bold leading-tight tracking-wide sm:text-4xl">
            Your room. Your rules.
          </h2>
          <p className="body-copy">
            An open code would be an open door, so it isn&apos;t one. Nobody enters a room you host without
            you saying yes, and the AI in it behaves the way you tell it to.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <RetroWindow
            title="Room settings.exe"
            icon={<Shield size={14} className="text-[var(--color-primary)]" />}
            bodyClassName="flex flex-col divide-y divide-[var(--color-border)]"
          >
            <ControlRow label="At the door">
              <span className="flex items-center gap-2">
                <Avatar name="Mia" size={22} />
                <span className="font-mono text-xs text-[var(--color-muted)]">Mia wants in</span>
                <span className="rounded-[3px] border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 px-2 py-0.5 font-mono text-xs text-[var(--color-primary)]">
                  Allow
                </span>
                <span className="rounded-[3px] border border-[var(--color-border)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted)]">
                  Block
                </span>
              </span>
            </ControlRow>

            <ControlRow label="Banned">
              <span className="flex items-center gap-2 font-mono text-xs text-[var(--color-muted)]">
                <Ban size={13} className="text-[var(--color-accent)]" />
                Name and account, both — no rejoining
              </span>
            </ControlRow>

            <ControlRow label="AI rules">
              <span className="block truncate rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-foreground)]">
                &ldquo;Stay in character as the dungeon master.&rdquo;
              </span>
            </ControlRow>

            <ControlRow label="Model">
              <span className="flex flex-wrap gap-1.5">
                {MODELS.map((m, i) => (
                  <span
                    key={m}
                    className={`rounded-[3px] border px-2 py-0.5 font-mono text-xs ${
                      i === 0
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-muted)]"
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </span>
            </ControlRow>

            <ControlRow label="Room cap">
              <span className="flex items-center gap-2 font-mono text-xs text-[var(--color-muted)]">
                <span className="rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[var(--color-foreground)]">
                  10
                </span>
                people max
              </span>
            </ControlRow>

            <ControlRow label="Danger zone">
              <span className="flex items-center gap-2 font-mono text-xs text-[var(--color-accent)]">
                <Trash2 size={13} />
                End the room, or delete it and its whole history
              </span>
            </ControlRow>
          </RetroWindow>
        </motion.div>
      </div>
    </section>
  );
}

/** Label on the left, live-looking state on the right — the shape of a real
 * settings panel, so the section reads as product rather than marketing. */
function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-28 shrink-0 font-mono text-xs uppercase tracking-widest text-[var(--color-foreground-subtle)]">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ------------------------------- Final CTA ------------------------------- */

function FinalCta({ onOpenRoom, onJoinCode }: { onOpenRoom: () => void; onJoinCode: () => void }) {
  return (
    <section className="relative border-t border-[var(--color-border)]/70 bg-[var(--color-surface)]/40">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-6 py-24 text-center">
        <motion.div {...reveal} className="flex flex-col items-center gap-5">
          <AiFace emotion="happy" size={64} />
          <h2 className="font-display text-[2.4rem] font-bold leading-[1.05] tracking-wide sm:text-5xl">
            Think out loud.
            <br />
            <span className="text-[var(--color-primary)]">Together.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex flex-wrap justify-center gap-3">
            <PixelButton onClick={onOpenRoom} className="px-6 py-3.5 text-sm">
              Open a room
              <ArrowRight size={16} />
            </PixelButton>
            <PixelButton variant="secondary" onClick={onJoinCode} className="px-6 py-3.5 text-sm">
              <KeyRound size={15} />
              Join with a code
            </PixelButton>
          </div>
          <p className="body-copy-sm text-center">
            No onboarding, no feed, no algorithm. Just a room and the people you gave the code to.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------- Footer -------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)]/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-6 py-10 text-center">
        <span className="flex items-center gap-2 font-display text-sm uppercase tracking-wide">
          <MessagesSquare size={14} className="text-[var(--color-primary)]" />
          Meetpoint.exe
        </span>
        <p className="font-mono text-xs text-[var(--color-foreground-subtle)]">
          Built for the group you already have.
        </p>
      </div>
    </footer>
  );
}
