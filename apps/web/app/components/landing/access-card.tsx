"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  DoorOpen,
  Hash,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  User,
  UserPlus,
} from "lucide-react";

import { pollJoinStatus, requestJoin } from "../../lib/access";
import { login as authLogin, register as authRegister, saveName, setToken } from "../../lib/auth";
import { Field } from "../ui/field";
import { PixelButton } from "../ui/pixel-button";
import { RetroWindow } from "../ui/retro-window";

type Tab = "join" | "host";
/** The guest side is a small state machine: fill the form, wait for the host
 * to answer the knock, or be told no. */
type JoinPhase = "form" | "waiting" | "denied";

const POLL_INTERVAL_MS = 1800;

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "join", label: "Join a room", icon: <DoorOpen size={13} /> },
  { id: "host", label: "Host sign-in", icon: <KeyRound size={13} /> },
];

export function AccessCard({
  onGuestReady,
  onHostAuthed,
  tab,
  onTabChange,
}: {
  onGuestReady: (code: string, displayName: string) => void;
  onHostAuthed: () => void;
  /** Controlled when the hero CTAs drive which tab is open; uncontrolled
   *  (internal state) otherwise. */
  tab?: Tab;
  onTabChange?: (tab: Tab) => void;
}) {
  const [ownTab, setOwnTab] = useState<Tab>("join");
  const active = tab ?? ownTab;
  const setTab = (next: Tab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };

  return (
    <RetroWindow
      title="ACCESS.EXE"
      icon={<DoorOpen size={14} className="text-[var(--color-primary)]" />}
      bodyClassName="flex flex-col"
    >
      <div role="tablist" aria-label="How you want to get in" className="grid grid-cols-2">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-3 font-display text-xs sm:text-[13px] uppercase tracking-wide transition-colors duration-150 cursor-pointer ${
                isActive ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {isActive ? (
                <motion.span
                  layoutId="access-tab-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 bg-[var(--color-primary)]/10 border-b-2 border-[var(--color-primary)]"
                />
              ) : (
                <span className="absolute inset-0 border-b border-[var(--color-border)]" />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                {t.icon}
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* `layout` keeps the card from snapping between the two panels' heights. */}
      <motion.div layout transition={{ duration: 0.22, ease: "easeOut" }} className="p-5 sm:p-6">
        {/* Keyed remount rather than AnimatePresence — `mode="wait"` holds the
          * incoming panel until the outgoing one has finished exiting, which
          * can leave the wrong form on screen after a tab press. */}
        <motion.div
          key={active}
          role="tabpanel"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {active === "join" ? (
            <JoinPanel onGuestReady={onGuestReady} />
          ) : (
            <HostPanel onHostAuthed={onHostAuthed} />
          )}
        </motion.div>
      </motion.div>
    </RetroWindow>
  );
}

/* ---------------------------------- Join ---------------------------------- */

function JoinPanel({ onGuestReady }: { onGuestReady: (code: string, displayName: string) => void }) {
  const reduced = useReducedMotion();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<JoinPhase>("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => stopPolling, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) return;
    setError("");
    setBusy(true);
    try {
      const { request_id } = await requestJoin(trimmedCode, trimmedName);
      setPhase("waiting");
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollJoinStatus(trimmedCode, request_id);
          if (status.status === "approved" && status.token) {
            stopPolling();
            setToken(status.token);
            saveName(status.display_name || trimmedName);
            onGuestReady(trimmedCode, status.display_name || trimmedName);
          } else if (status.status === "denied") {
            stopPolling();
            setPhase("denied");
          }
        } catch (err) {
          stopPolling();
          setError((err as Error).message);
          setPhase("form");
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (phase === "waiting") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        {/* The only indefinite animation in this card, so it is the one that
          * has to stop when reduced motion is asked for. */}
        <motion.span
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          className="text-[var(--color-primary)]"
        >
          <Loader2 size={30} />
        </motion.span>
        <p className="font-display text-lg tracking-wide">Knocking…</p>
        <p className="body-copy-sm max-w-[28ch]">
          <span className="text-[var(--color-foreground)]">{name.trim()}</span> is asking to join{" "}
          <span className="font-mono text-[var(--color-foreground)]">{code.toUpperCase()}</span>. The host
          decides who comes in.
        </p>
        <button
          onClick={() => {
            stopPolling();
            setPhase("form");
          }}
          className="text-[var(--color-ring)] text-sm underline decoration-dotted underline-offset-4 hover:opacity-80 transition-opacity duration-150 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {phase === "denied" ? (
        <p role="alert" className="body-copy-sm !text-[var(--color-accent)]">
          The host didn&apos;t let you in that time.
        </p>
      ) : null}

      <Field icon={<User size={16} />} label="Your name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          className="input-field"
          autoComplete="off"
          maxLength={64}
          required
        />
      </Field>
      <Field icon={<Hash size={16} />} label="Room code">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          className="input-field font-mono tracking-[0.25em] uppercase"
          autoComplete="off"
          maxLength={12}
          required
        />
      </Field>

      {error ? (
        <p role="alert" className="body-copy-sm !text-[var(--color-accent)]">
          {error}
        </p>
      ) : null}

      <PixelButton type="submit" disabled={busy} className="mt-1">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        {busy ? "Asking…" : "Ask to join"}
      </PixelButton>
      <p className="body-copy-sm">
        No account, no password. The host sees your name and lets you in.
      </p>
    </form>
  );
}

/* ---------------------------------- Host ---------------------------------- */

function HostPanel({ onHostAuthed }: { onHostAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await authRegister(email.trim(), password, displayName.trim());
      }
      await authLogin(email.trim(), password);
      saveName(displayName.trim() || email.split("@")[0]);
      onHostAuthed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {mode === "register" ? (
        <Field icon={<User size={16} />} label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How others will see you"
            className="input-field"
            autoComplete="name"
          />
        </Field>
      ) : null}
      <Field icon={<Mail size={16} />} label="Email">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@example.com"
          className="input-field"
          autoComplete="email"
          required
        />
      </Field>
      <Field icon={<KeyRound size={16} />} label="Password">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
          className="input-field"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
        />
      </Field>

      {error ? (
        <p role="alert" className="body-copy-sm !text-[var(--color-accent)]">
          {error}
        </p>
      ) : null}

      <PixelButton type="submit" disabled={busy} className="mt-1">
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : mode === "login" ? (
          <LogIn size={16} />
        ) : (
          <UserPlus size={16} />
        )}
        {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
      </PixelButton>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
        className="text-[var(--color-ring)] text-sm underline decoration-dotted underline-offset-4 hover:opacity-80 transition-opacity duration-150 cursor-pointer self-start"
      >
        {mode === "login" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
      <p className="body-copy-sm">
        Hosts open rooms, write the AI&apos;s rules, and decide who gets in. Only hosts need an account.
      </p>
    </form>
  );
}
