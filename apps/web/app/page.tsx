"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Copy,
  DoorOpen,
  Hash,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Monitor,
  MoreVertical,
  Moon,
  Plus,
  Reply,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  Trash2,
  Type,
  User,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import {
  register as authRegister,
  login as authLogin,
  me as authMe,
  getToken,
  saveName,
  logout,
  type AuthUser,
} from "./lib/auth";
import {
  createRoom,
  joinRoom,
  getMyRooms,
  getMessages,
  deleteRoomByCode,
  updateRoomPrompt,
  inviteToRoom,
  type MyRoom,
} from "./lib/rooms";
import { listAllRooms, deleteRoom, type AdminRoom } from "./lib/admin";
import { connectToRoom, disconnect, sendMessage, sendTyping, endRoom } from "./lib/rt";
import { useRoom, type ChatEntry, type Emotion } from "./lib/store";
import { cycleTheme, getStoredTheme, type Theme } from "./lib/theme";
import { getStoredChatFont, toggleChatFont, type ChatFont } from "./lib/font";
import { RetroWindow } from "./components/ui/retro-window";
import { PixelButton } from "./components/ui/pixel-button";
import { StatusIndicator } from "./components/ui/status-indicator";
import { PixelBubble } from "./components/ui/pixel-bubble";
import { AiFace } from "./components/ui/ai-face";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:8000";

type Mode = "login" | "register";
type View = "lobby" | "room" | "admin";

/* ---------------------------------- Auth ---------------------------------- */

function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
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
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-[var(--color-background)] text-[var(--color-foreground)] flex flex-col items-center justify-center gap-8 px-6 overflow-hidden">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <ThemeToggle />
        <ChatFontToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative flex flex-col items-center gap-2 text-center"
      >
        <span className="text-xs tracking-[0.3em] text-[var(--color-primary)] uppercase font-mono">
          Chat Rooms
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wide text-[var(--color-foreground)]">
          MEETPOINT.EXE
        </h1>
        <p className="max-w-sm text-[var(--color-muted)] text-sm leading-relaxed">
          Create a room, share the code, and chat once someone else joins.
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        onSubmit={submit}
        className="relative w-full max-w-sm"
      >
      <RetroWindow title="LOGIN.EXE" bodyClassName="p-6 flex flex-col gap-3">
        {mode === "register" ? (
          <Field icon={<User size={16} />} label="Display name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How others will see you"
              className="input-field"
              autoFocus
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
            autoComplete="current-password"
            required
            minLength={6}
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[var(--color-accent)] text-sm">
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
          className="text-[var(--color-ring)] text-sm underline decoration-dotted underline-offset-4 hover:opacity-80 transition-opacity duration-150 cursor-pointer"
        >
          {mode === "login" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
      </RetroWindow>
      </motion.form>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

/* -------------------------------- Theme toggle -------------------------------- */

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

function ThemeToggle({ className = "" }: { className?: string }) {
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
      className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-[3px] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border-strong)] transition-colors duration-150 cursor-pointer ${className}`}
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
function ChatFontToggle({ className = "" }: { className?: string }) {
  const [font, setFont] = useState<ChatFont>("poppins");

  useEffect(() => {
    setFont(getStoredChatFont());
  }, []);

  return (
    <button
      onClick={() => setFont(toggleChatFont(font))}
      title={`Chat font: ${CHAT_FONT_LABELS[font]} (click to change)`}
      aria-label="Change chat font"
      className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-[3px] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border-strong)] transition-colors duration-150 cursor-pointer ${className}`}
    >
      <Type size={14} />
      <span className="hidden sm:inline">{CHAT_FONT_LABELS[font]}</span>
    </button>
  );
}

/* -------------------------------- Root gate -------------------------------- */

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<View>("lobby");
  const [roomCode, setRoomCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          setUser(await authMe(token));
          setAuthed(true);
        } catch {
          logout();
        }
      }
      setChecked(true);
    })();
  }, []);

  if (!checked) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)] text-[var(--color-foreground)] flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!authed) {
    return (
      <AuthScreen
        onAuthed={() => {
          const token = getToken();
          if (token) authMe(token).then(setUser);
          setAuthed(true);
        }}
      />
    );
  }

  if (view === "admin") {
    return <AdminPanel onBack={() => setView("lobby")} />;
  }

  if (view === "room" && roomCode) {
    return (
      <ChatRoomScreen
        code={roomCode}
        onLeave={() => {
          disconnect();
          useRoom.getState().reset();
          setRoomCode(null);
          setView("lobby");
        }}
      />
    );
  }

  return (
    <Lobby
      isAdmin={!!user?.is_superuser}
      onEntered={(code) => {
        setRoomCode(code);
        setView("room");
      }}
      onOpenAdmin={() => setView("admin")}
      onLogout={() => {
        logout();
        window.location.reload();
      }}
    />
  );
}

/* --------------------------------- Lobby ----------------------------------- */

function Lobby({
  isAdmin,
  onEntered,
  onOpenAdmin,
  onLogout,
}: {
  isAdmin: boolean;
  onEntered: (code: string) => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [roomName, setRoomName] = useState("");
  const [minPlayers, setMinPlayers] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Session expired, sign in again");
      const room = await createRoom(token, roomName.trim() || "Untitled Room", {
        minPlayers,
        maxPlayers,
        systemPrompt,
      });
      onEntered(room.code);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Session expired, sign in again");
      const room = await joinRoom(token, joinCode.trim());
      onEntered(room.code);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-background)] text-[var(--color-foreground)] flex flex-col items-center gap-8 px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center gap-2 text-center"
      >
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-[var(--color-foreground)]">ROOMS.EXE</h1>
        <p className="text-[var(--color-muted)] text-sm">Create a room or join one with a code.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
        className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start"
      >
      <RetroWindow title="NEW_ROOM.EXE" bodyClassName="p-6 flex flex-col gap-4">
        <div className="flex rounded-[3px] border border-[var(--color-border)] overflow-hidden">
          <TabButton active={tab === "create"} onClick={() => setTab("create")} icon={<Plus size={15} />} label="Create" />
          <TabButton active={tab === "join"} onClick={() => setTab("join")} icon={<DoorOpen size={15} />} label="Join" />
        </div>

        {tab === "create" ? (
          <form onSubmit={create} className="flex flex-col gap-3">
            <Field icon={<Users size={16} />} label="Room name">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Friday hangout"
                className="input-field"
                autoFocus
              />
            </Field>
            <div className="flex gap-3">
              <Field icon={<Users size={16} />} label="Min players" className="flex-1 min-w-0">
                <input
                  type="number"
                  min={1}
                  max={maxPlayers}
                  value={minPlayers}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(Number(e.target.value) || 1, maxPlayers));
                    setMinPlayers(v);
                  }}
                  className="input-field w-full"
                />
              </Field>
              <Field icon={<Users size={16} />} label="Max players" className="flex-1 min-w-0">
                <input
                  type="number"
                  min={minPlayers}
                  max={10}
                  value={maxPlayers}
                  onChange={(e) => {
                    const v = Math.max(minPlayers, Math.min(Number(e.target.value) || 10, 10));
                    setMaxPlayers(v);
                  }}
                  className="input-field w-full"
                />
              </Field>
            </div>
            <Field icon={<Sparkles size={16} />} label="AI rules (optional)">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder='e.g. "Stay in character as a dungeon master" or "Never reveal riddle answers"'
                rows={3}
                className="input-field resize-none"
              />
            </Field>
            {error ? <p className="text-[var(--color-accent)] text-sm">{error}</p> : null}
            <PixelButton type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create room
            </PixelButton>
          </form>
        ) : (
          <form onSubmit={join} className="flex flex-col gap-3">
            <Field icon={<Hash size={16} />} label="Room code">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="input-field font-mono tracking-widest uppercase"
                autoFocus
                maxLength={12}
              />
            </Field>
            {error ? <p className="text-[var(--color-accent)] text-sm">{error}</p> : null}
            <PixelButton type="submit" disabled={busy || !joinCode.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <DoorOpen size={16} />}
              Join room
            </PixelButton>
          </form>
        )}
      </RetroWindow>

        <MyRoomsPanel onOpen={onEntered} />
      </motion.div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        <ChatFontToggle />
        {isAdmin ? (
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 text-[var(--color-arcane)] text-sm hover:brightness-110 transition-[filter] duration-150 cursor-pointer"
          >
            <Shield size={14} />
            Admin panel
          </button>
        ) : null}
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-[var(--color-muted)] text-sm hover:text-[var(--color-accent)] transition-colors duration-150 cursor-pointer"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-display uppercase tracking-wide transition-colors duration-150 cursor-pointer ${
        active
          ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------- My rooms (lazy) ----------------------------- */

const PAGE_SIZE = 10;

function MyRoomsPanel({ onOpen }: { onOpen: (code: string) => void }) {
  const [rooms, setRooms] = useState<MyRoom[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const loadMore = async () => {
    const token = getToken();
    if (!token || loading || !hasMore) return;
    setLoading(true);
    try {
      const page = await getMyRooms(token, PAGE_SIZE, offset);
      setRooms((prev) => {
        const seen = new Set(prev.map((r) => r.code));
        return [...prev, ...page.filter((r) => !seen.has(r.code))];
      });
      setOffset(offset + page.length);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The list scrolls inside its own card now (not the page), so the bottom
  // sentinel must be observed against that inner container, not the viewport.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });
  useEffect(() => {
    const root = scrollContainerRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      { root, rootMargin: "100px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loaded]);

  const enter = async (code: string) => {
    const token = getToken();
    if (!token) return;
    await joinRoom(token, code); // idempotent — you're already a member
    onOpen(code);
  };

  const remove = async (e: React.MouseEvent, room: MyRoom) => {
    e.stopPropagation();
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Delete room "${room.name}" (${room.code})? This removes its full history.`)) return;
    setError("");
    try {
      await deleteRoomByCode(token, room.code);
      setRooms((prev) => prev.filter((r) => r.code !== room.code));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <RetroWindow
      title="MY_ROOMS.EXE"
      headerRight={loading && rooms.length > 0 ? <Loader2 size={13} className="animate-spin text-[var(--color-muted)]" /> : null}
      className="w-full h-full min-h-[280px]"
      bodyClassName="p-6 flex flex-col gap-3"
    >
      {error ? <p className="text-[var(--color-accent)] text-xs">{error}</p> : null}

      {loaded && rooms.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
          <Users size={22} className="text-[var(--color-foreground-subtle)]" />
          <p className="text-sm text-[var(--color-muted)]">No rooms yet.</p>
          <p className="text-xs text-[var(--color-foreground-subtle)] max-w-[22ch]">
            Create one or join with a code — it'll show up here.
          </p>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex flex-col divide-y divide-[var(--color-border)] max-h-[420px] overflow-y-auto ember-scroll -mx-2 px-2"
        >
          {rooms.map((r) => (
            <div
              key={r.code}
              role="button"
              tabIndex={0}
              onClick={() => enter(r.code)}
              onKeyDown={(e) => e.key === "Enter" && enter(r.code)}
              className="group flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-lg text-left hover:bg-[var(--color-surface-raised)] transition-colors duration-150 cursor-pointer"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{r.name}</span>
                <span className="text-xs text-[var(--color-muted)] font-mono">{r.code}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs text-[var(--color-muted)]">
                {r.is_host ? <span className="text-[var(--color-ember)]">host</span> : null}
                <RoomStatusPill status={r.status} />
                <span className="hidden sm:flex items-center gap-1">
                  <Users size={12} />
                  {r.member_count}
                </span>
                {r.is_host ? (
                  <button
                    onClick={(e) => remove(e, r)}
                    title="Delete room"
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-[3px] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors duration-150 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {hasMore ? (
            <div ref={sentinelRef} className="flex items-center justify-center py-3">
              {loading ? <Loader2 size={14} className="animate-spin text-[var(--color-muted)]" /> : null}
            </div>
          ) : null}
        </div>
      )}
    </RetroWindow>
  );
}

/** Fires `loadMore` when a sentinel element scrolls into view, instead of a
 * button — used for bottom-of-list and top-of-chat lazy loading alike.
 * `loadMore` is read from a ref each time so the observer (set up once)
 * never calls a stale closure. */
function useScrollLoader(loadMore: () => void, options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMoreRef.current();
    }, options);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.root]);

  return ref;
}

function useBottomScrollLoader(loadMore: () => void) {
  return useScrollLoader(loadMore, { rootMargin: "200px" });
}

function RoomStatusPill({ status }: { status: string }) {
  const style =
    status === "closed"
      ? "text-[var(--color-foreground-subtle)] border-[var(--color-border)]"
      : status === "active"
        ? "text-emerald-400 border-emerald-400/30"
        : "text-[var(--color-primary)] border-[var(--color-primary)]/30";
  return <span className={`px-1.5 py-0.5 rounded-[3px] border font-mono text-[10px] uppercase ${style}`}>{status}</span>;
}

/* --------------------------------- Admin panel -------------------------------- */

function AdminPanel({ onBack }: { onBack: () => void }) {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMore = async () => {
    const token = getToken();
    if (!token || loading || !hasMore) return;
    setLoading(true);
    setError("");
    try {
      const page = await listAllRooms(token, PAGE_SIZE, offset);
      setRooms((prev) => [...prev, ...page]);
      setOffset(offset + page.length);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sentinelRef = useBottomScrollLoader(loadMore);

  const remove = async (room: AdminRoom) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Delete room "${room.name}" (${room.code})? This removes its full history.`)) return;
    try {
      await deleteRoom(token, room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-background)] text-[var(--color-foreground)] px-6 py-10 flex flex-col items-center gap-6">
      <div className="w-full max-w-2xl">
        <RetroWindow
          title="ADMIN.EXE"
          icon={<ShieldAlert size={14} className="text-[var(--color-arcane)]" />}
          headerRight={
            <button
              onClick={onBack}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
            >
              ← Lobby
            </button>
          }
          bodyClassName="p-4 flex flex-col gap-2"
        >
        {error ? <p className="text-[var(--color-accent)] text-sm">{error}</p> : null}
        <div className="overflow-x-auto rounded-[3px] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface)] text-[var(--color-muted)] text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Room</th>
                <th className="hidden sm:table-cell text-left px-3 py-2">Host</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Members</th>
                <th className="hidden md:table-cell text-left px-3 py-2">Created</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs font-mono text-[var(--color-muted)]">{r.code}</div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2 text-[var(--color-muted)]">{r.host_email}</td>
                  <td className="px-3 py-2">
                    <RoomStatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-[var(--color-muted)]">
                    {r.online_count}/{r.member_count} online
                  </td>
                  <td className="hidden md:table-cell px-3 py-2 text-[var(--color-muted)]">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(r)}
                      title="Delete room"
                      className="flex items-center justify-center w-8 h-8 rounded-[3px] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors duration-150 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-muted)]">
                    No rooms yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {hasMore ? (
          <div ref={sentinelRef} className="flex items-center justify-center py-2">
            {loading ? <Loader2 size={14} className="animate-spin text-[var(--color-muted)]" /> : null}
          </div>
        ) : null}
        </RetroWindow>
      </div>
    </div>
  );
}

/* -------------------------------- Rules panel -------------------------------- */

function RulesPanel({ code, isHost, onClose }: { code: string; isHost: boolean; onClose: () => void }) {
  const systemPrompt = useRoom((s) => s.systemPrompt);
  const [draft, setDraft] = useState(systemPrompt);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await updateRoomPrompt(token, code, draft);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)]/60"
    >
      <div className="px-4 sm:px-6 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--color-arcane)] font-mono">
            <Sparkles size={12} />
            Rules for the AI in this room
          </span>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder='e.g. "Stay in character as a dungeon master" or "Never reveal riddle answers"'
              rows={3}
              className="input-field resize-none text-sm"
              autoFocus
            />
            {error ? <p className="text-[var(--color-accent)] text-xs">{error}</p> : null}
            <div className="flex gap-2">
              <PixelButton onClick={save} disabled={busy} className="text-xs px-3 py-1.5">
                {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                Save
              </PixelButton>
              <button
                onClick={() => {
                  setDraft(systemPrompt);
                  setEditing(false);
                  setError("");
                }}
                className="text-xs px-3 py-1.5 rounded-[3px] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-[var(--color-foreground)]/85 whitespace-pre-wrap">
              {systemPrompt || (
                <span className="text-[var(--color-foreground-subtle)] italic">
                  No custom rules set — the AI just chats normally.
                </span>
              )}
            </p>
            {isHost ? (
              <button
                onClick={() => {
                  setDraft(systemPrompt);
                  setEditing(true);
                }}
                className="shrink-0 text-xs px-2.5 py-1 rounded-[3px] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
              >
                Edit
              </button>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* -------------------------------- Invite panel -------------------------------- */

function InvitePanel({ code, onClose }: { code: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invited, setInvited] = useState<string | null>(null);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await inviteToRoom(token, code, email.trim());
      setInvited(email.trim());
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)]/60"
    >
      <div className="px-4 sm:px-6 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--color-primary)] font-mono">
            <UserPlus size={12} />
            Invite by email
          </span>
          <button
            onClick={onClose}
            className="text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
        <form onSubmit={invite} className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="input-field flex-1"
            autoFocus
          />
          <PixelButton type="submit" disabled={busy || !email.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Invite"}
          </PixelButton>
        </form>
        <p className="text-xs text-[var(--color-foreground-subtle)]">
          They'll see this room in their room list next time they log in — no code needed.
        </p>
        {invited ? (
          <p className="text-xs text-[var(--color-primary)]">Invited {invited}.</p>
        ) : null}
        {error ? <p className="text-xs text-[var(--color-accent)]">{error}</p> : null}
      </div>
    </motion.div>
  );
}

/* -------------------------------- Chat room -------------------------------- */

function ChatRoomScreen({ code, onLeave }: { code: string; onLeave: () => void }) {
  const room = useRoom();
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      authMe(token).then((u) => useRoom.getState().setUserId(u.id));
      connectToRoom(SOCKET_URL, code, token);
    }
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Only snap to the bottom when a message is appended (new arrival) — not
  // when older history is prepended by scrolling up, which restores its own
  // scroll offset below.
  const lastEntryId = room.entries.length ? room.entries[room.entries.length - 1].id : null;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEntryId, room.aiDraft]);

  const loadOlderHistory = async () => {
    const state = useRoom.getState();
    if (!state.hasMoreHistory || state.loadingOlder || !state.oldestMessageId) return;
    const token = getToken();
    if (!token) return;
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    const prevTop = container?.scrollTop ?? 0;
    state.setLoadingOlder(true);
    try {
      const page = await getMessages(token, code, { before: state.oldestMessageId, limit: 30 });
      useRoom.getState().prependHistory(page.messages, page.has_more);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight + prevTop;
      });
    } catch {
      // best-effort — leave hasMoreHistory as-is so scrolling up again retries
    } finally {
      useRoom.getState().setLoadingOlder(false);
    }
  };

  const loadOlderRef = useRef(loadOlderHistory);
  useEffect(() => {
    loadOlderRef.current = loadOlderHistory;
  });

  // Scroll-up pagination: fetch the previous page when the top sentinel
  // enters the chat scroll container's viewport, ChatGPT/Slack-style — no
  // "load more" button, and the scroll position is preserved above.
  useEffect(() => {
    const root = scrollRef.current;
    const target = topSentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadOlderRef.current();
      },
      { root, rootMargin: "300px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [code]);

  const onlineCount = room.members.filter((m) => m.isOnline).length;
  const canChat = room.joined && onlineCount >= room.minPlayers && !room.closed;
  const sendLocked = room.aiStreaming;
  const isHost = room.userId !== "" && room.userId === room.hostUserId;

  const submit = () => {
    const text = draft.trim();
    if (!text || !canChat || sendLocked) return;
    sendMessage(text, room.replyDraft?.id ?? null);
    setDraft("");
    sendTyping(false);
    useRoom.getState().setReplyDraft(null);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable, ignore */
    }
  };

  const handleEndRoom = () => {
    if (window.confirm("End this room for everyone? This closes it permanently.")) {
      endRoom();
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm(`Delete "${room.name || code}"? This permanently removes its full history.`)) return;
    const token = getToken();
    if (!token) return;
    try {
      await deleteRoomByCode(token, code);
      onLeave();
    } catch (err) {
      useRoom.getState().setError((err as Error).message);
    }
  };

  return (
    <div className="flex h-dvh bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="flex flex-col flex-1 min-w-0 border-t border-[var(--color-border)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 sm:px-6 py-3 bg-[var(--color-surface)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display font-medium text-sm sm:text-base tracking-wide uppercase text-[var(--color-foreground)] truncate">
              {(room.name || "Room").toUpperCase()}.EXE
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-[3px] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
              title="Copy room code"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {code}
            </button>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle className="hidden md:flex" />
            <ChatFontToggle className="hidden md:flex" />
            <ConnectionBadge connected={room.connected} />
            <span className="hidden lg:flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
              <Users size={15} />
              {onlineCount}/{room.members.length}
              <span className="text-[var(--color-foreground-subtle)]">(max {room.maxPlayers})</span>
            </span>
            <button
              onClick={() => setShowMembers(true)}
              title="Members"
              aria-label="Show members"
              className="lg:hidden flex items-center gap-1 text-xs font-mono px-2 py-1.5 rounded-[3px] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
            >
              <Users size={14} />
              {onlineCount}/{room.members.length}
            </button>
            <button
              onClick={() => setShowRules((v) => !v)}
              title="AI rules for this room"
              className={`flex items-center justify-center sm:gap-1.5 sm:px-2.5 w-9 h-9 sm:w-auto sm:h-auto sm:py-1.5 rounded-[3px] border transition-colors duration-150 cursor-pointer ${
                showRules
                  ? "border-[var(--color-arcane)]/50 bg-[var(--color-arcane)]/15 text-[var(--color-arcane)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline text-xs font-mono uppercase">Rules</span>
            </button>
            {isHost ? (
              <div className="relative">
                <button
                  onClick={() => setShowHostMenu((v) => !v)}
                  title="Room settings"
                  aria-label="Room settings"
                  className={`flex items-center justify-center w-9 h-9 rounded-[3px] transition-colors duration-150 cursor-pointer ${
                    showHostMenu
                      ? "bg-[var(--color-surface-raised)] text-[var(--color-foreground)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)]"
                  }`}
                >
                  <MoreVertical size={17} />
                </button>
                <AnimatePresence>
                  {showHostMenu ? (
                    <HostMenu
                      canEndRoom={!room.closed}
                      onInvite={() => {
                        setShowHostMenu(false);
                        setShowInvite(true);
                      }}
                      onEndRoom={() => {
                        setShowHostMenu(false);
                        handleEndRoom();
                      }}
                      onDeleteRoom={() => {
                        setShowHostMenu(false);
                        handleDeleteRoom();
                      }}
                      onClose={() => setShowHostMenu(false)}
                    />
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
            <button
              onClick={onLeave}
              aria-label="Leave room"
              title="Leave room"
              className="flex items-center justify-center w-9 h-9 rounded-[3px] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors duration-150 cursor-pointer"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <AnimatePresence>
          {showRules ? (
            <RulesPanel code={code} isHost={isHost} onClose={() => setShowRules(false)} />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {showInvite ? <InvitePanel code={code} onClose={() => setShowInvite(false)} /> : null}
        </AnimatePresence>

        <AnimatePresence>
          {room.lastError ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[var(--color-accent)]/15 text-[var(--color-accent)] px-4 py-1.5 text-sm border-b border-[var(--color-accent)]/30 overflow-hidden"
            >
              {room.lastError}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {room.closed ? (
          <div className="bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-4 py-2 text-sm border-b border-[var(--color-accent)]/25">
            This room has been closed. History below is read-only.
          </div>
        ) : !room.joined ? (
          <div className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-4 py-2 text-sm border-b border-[var(--color-primary)]/25 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading room…
          </div>
        ) : !canChat ? (
          <div className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-4 py-2 text-sm border-b border-[var(--color-primary)]/25 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Waiting for at least {room.minPlayers} people to join before you can chat…
          </div>
        ) : null}

        <div ref={scrollRef} className="ember-scroll flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3">
          <div ref={topSentinelRef} />
          {room.loadingOlder ? (
            <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-muted)] py-2">
              <Loader2 size={13} className="animate-spin" />
              Loading older messages…
            </div>
          ) : null}
          <AnimatePresence initial={false}>
            {room.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} youId={room.userId} />
            ))}
          </AnimatePresence>
          {room.aiStreaming && room.aiDraft ? (
            <AiStreamingBubble text={room.aiDraft} emotion={room.aiEmotion} />
          ) : null}
          <TypingIndicator names={room.typing} />
        </div>

        {room.replyDraft ? (
          <div className="flex items-center gap-2 px-4 sm:px-6 pt-2 bg-[var(--color-surface)]/70">
            <div className="flex-1 flex items-center gap-2 min-w-0 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs">
              <Reply size={12} className="text-[var(--color-muted)] shrink-0" />
              <span className="text-[var(--color-primary)] font-medium shrink-0">{room.replyDraft.authorName}</span>
              <span className="truncate text-[var(--color-muted)]">{room.replyDraft.body}</span>
            </div>
            <button
              onClick={() => useRoom.getState().setReplyDraft(null)}
              className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {sendLocked && !room.closed ? (
          <div className="px-4 sm:px-6 pt-2 bg-[var(--color-surface)]/70 flex items-center gap-1.5 text-xs text-[var(--color-arcane)]">
            <Sparkles size={12} />
            AI is responding — hang on a moment, you can send once it's done.
          </div>
        ) : null}

        <InputBar
          draft={draft}
          disabled={!canChat}
          sendLocked={sendLocked}
          onChange={(v) => {
            setDraft(v);
            if (!room.closed) sendTyping(v.length > 0);
          }}
          onSubmit={submit}
        />
      </div>

      <PresenceSidebar members={room.members} youId={room.userId} />
      <AnimatePresence>
        {showMembers ? (
          <MembersDrawer members={room.members} youId={room.userId} onClose={() => setShowMembers(false)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-[3px] border transition-colors duration-300 ${
        connected
          ? "text-[var(--color-primary)] border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10"
          : "text-[var(--color-accent)] border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10"
      }`}
    >
      {connected ? <Wifi size={12} /> : <WifiOff size={12} className="animate-pulse" />}
      <span className="hidden sm:inline">{connected ? "Connected" : "Reconnecting…"}</span>
    </span>
  );
}

type MemberBrief = { userId: string; displayName: string; isOnline: boolean; isHost: boolean };

function MemberList({ members, youId }: { members: MemberBrief[]; youId: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center gap-2 text-sm">
          <span className="relative">
            <Avatar name={m.displayName} size={26} />
            <StatusIndicator
              online={m.isOnline}
              size={10}
              className="absolute -bottom-0.5 -right-0.5 border-2 border-[var(--color-surface)]"
            />
          </span>
          <span className="truncate">
            {m.displayName}
            {m.userId === youId ? <span className="text-[var(--color-primary)] text-xs ml-1">(you)</span> : null}
            {m.isHost ? <span className="text-[var(--color-ember)] text-xs ml-1">host</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Static member list — only shown on wide screens where there's room for it. */
function PresenceSidebar({ members, youId }: { members: MemberBrief[]; youId: string }) {
  return (
    <aside className="hidden lg:flex flex-col w-56 border-l border-[var(--color-border)] bg-[var(--color-surface)]/50 px-4 py-5 gap-4">
      <h2 className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--color-muted)] font-mono">
        <Users size={13} />
        PLAYERS.EXE ({members.length})
      </h2>
      <MemberList members={members} youId={youId} />
    </aside>
  );
}

/** Same member list, reached via the header button on narrow screens where
 * the static sidebar has no room. */
function MembersDrawer({
  members,
  youId,
  onClose,
}: {
  members: MemberBrief[];
  youId: string;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="lg:hidden fixed inset-0 bg-black/50 z-40"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="lg:hidden fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-[var(--color-surface)] border-l border-[var(--color-border)] px-4 py-5 flex flex-col gap-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--color-muted)] font-mono">
            <Users size={13} />
            PLAYERS.EXE ({members.length})
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors duration-150 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto ember-scroll">
          <MemberList members={members} youId={youId} />
        </div>
      </motion.aside>
    </>
  );
}

/** Host-only actions collapsed into a menu so the header stays usable on
 * narrow screens instead of a row of always-visible buttons. */
function HostMenu({
  canEndRoom,
  onInvite,
  onEndRoom,
  onDeleteRoom,
  onClose,
}: {
  canEndRoom: boolean;
  onInvite: () => void;
  onEndRoom: () => void;
  onDeleteRoom: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="absolute right-0 top-11 z-50 w-48 rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl shadow-black/40 py-1.5 overflow-hidden"
      >
        <button
          onClick={onInvite}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)] transition-colors duration-150 cursor-pointer"
        >
          <UserPlus size={14} />
          Invite people
        </button>
        {canEndRoom ? (
          <button
            onClick={onEndRoom}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors duration-150 cursor-pointer"
          >
            <DoorOpen size={14} />
            End room
          </button>
        ) : null}
        <button
          onClick={onDeleteRoom}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors duration-150 cursor-pointer"
        >
          <Trash2 size={14} />
          Delete room
        </button>
      </motion.div>
    </>
  );
}

/* -------------------------------- Message log ------------------------------- */

// Muted variants of the palette's two hues (mint, accent) instead of bright
// rainbow tags — keeps per-user distinction without breaking the "not overly
// colorful" rule.
const AVATAR_PALETTE = [
  "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/40",
  "bg-[var(--color-muted)]/20 text-[var(--color-muted)] border-[var(--color-muted)]/40",
  "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/40",
  "bg-[var(--color-foreground-subtle)]/20 text-[var(--color-foreground-subtle)] border-[var(--color-foreground-subtle)]/40",
  "bg-[var(--color-ember)]/20 text-[var(--color-ember)] border-[var(--color-ember)]/40",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const palette = AVATAR_PALETTE[hashName(name || "?") % AVATAR_PALETTE.length];
  return (
    <span
      className={`flex items-center justify-center rounded-[3px] border font-display font-semibold shrink-0 ${palette}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Renders AI responses (markdown: **bold**, lists, `code`, links, etc.) with
 * spacing/colors matching the chat theme instead of react-markdown's bare
 * browser defaults (Tailwind's preflight strips those anyway). */
function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`markdown-body font-body text-sm leading-relaxed space-y-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = /language-/.test(codeClassName || "");
            return isBlock ? (
              <code className={codeClassName}>{children}</code>
            ) : (
              <code className="px-1 py-0.5 rounded bg-black/25 font-mono text-[0.85em]">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="rounded-lg bg-black/30 border border-[var(--color-border)] px-3 py-2 overflow-x-auto font-mono text-xs">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-current/30 pl-3 opacity-90">{children}</blockquote>
          ),
          h1: ({ children }) => <p className="font-semibold text-base">{children}</p>,
          h2: ({ children }) => <p className="font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-left border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[var(--color-surface-raised)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-[var(--color-border)]">{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 font-medium whitespace-nowrap">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ReplyQuote({ quote }: { quote: { authorName: string; body: string } }) {
  // Inherits currentColor + reduced opacity rather than a fixed theme token,
  // since this renders both inside theme-colored blocks (AI messages) and
  // inside the pixel bubble's fixed black-on-white fill.
  return (
    <div className="flex items-center gap-1.5 text-xs opacity-70 border-l-2 border-current/30 pl-2 mb-1 max-w-full">
      <span className="font-semibold shrink-0">{quote.authorName}</span>
      <span className="truncate">{quote.body}</span>
    </div>
  );
}

function EntryRow({ entry, youId }: { entry: ChatEntry; youId: string }) {
  const isSelf = entry.authorId === youId;

  if (entry.kind === "system") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 py-1 text-[var(--color-foreground-subtle)] text-xs"
      >
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="font-mono uppercase tracking-wider text-[10px]">{entry.text}</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </motion.div>
    );
  }

  if (entry.kind === "ai") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="group flex gap-3 border-l-2 border-[var(--color-arcane)]/50 pl-4 py-1"
      >
        <AiFace emotion={entry.emotion ?? "neutral"} size={40} className="mt-0.5" />
        <div className="flex-1 min-w-0">
          {entry.replyTo ? <ReplyQuote quote={entry.replyTo} /> : null}
          <Markdown text={entry.text} className="text-[var(--color-arcane)]/90" />
        </div>
        <ReplyButton entry={entry} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group flex items-end gap-2 mb-2 ${isSelf ? "flex-row-reverse" : ""}`}
    >
      <Avatar name={entry.author} size={24} />
      <div className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[70%] ${isSelf ? "items-end" : "items-start"}`}>
        <span
          className={`font-mono text-xs uppercase tracking-wide ${
            isSelf ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]"
          }`}
        >
          {entry.author}
        </span>
        <SwipeToReply side={isSelf ? "right" : "left"} onReply={() => startReply(entry)}>
          <PixelBubble side={isSelf ? "right" : "left"} tinted={isSelf}>
            {entry.replyTo ? <ReplyQuote quote={entry.replyTo} /> : null}
            {entry.text}
          </PixelBubble>
        </SwipeToReply>
      </div>
      <ReplyButton entry={entry} />
    </motion.div>
  );
}

function startReply(entry: ChatEntry): void {
  useRoom.getState().setReplyDraft({ id: entry.id, authorName: entry.author, body: entry.text });
}

function ReplyButton({ entry }: { entry: ChatEntry }) {
  return (
    <button
      onClick={() => startReply(entry)}
      title="Reply"
      className="opacity-0 group-hover:opacity-100 self-center shrink-0 text-[var(--color-foreground-subtle)] hover:text-[var(--color-primary)] transition-opacity duration-150 cursor-pointer"
    >
      <Reply size={14} />
    </button>
  );
}

const SWIPE_REPLY_THRESHOLD = 56;

/** Mobile swipe-to-reply: drag a message bubble horizontally past the
 * threshold to reply to it, matching the WhatsApp/Telegram gesture. Desktop
 * keeps the hover ReplyButton; this is additive, not a replacement. */
function SwipeToReply({
  side,
  onReply,
  children,
}: {
  side: "left" | "right";
  onReply: () => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const iconOpacity = useTransform(
    x,
    side === "left" ? [0, SWIPE_REPLY_THRESHOLD] : [-SWIPE_REPLY_THRESHOLD, 0],
    side === "left" ? [0, 1] : [1, 0]
  );
  const constraints = side === "left" ? { left: 0, right: 96 } : { left: -96, right: 0 };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const passed =
      side === "left" ? info.offset.x > SWIPE_REPLY_THRESHOLD : info.offset.x < -SWIPE_REPLY_THRESHOLD;
    if (passed) onReply();
    animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  };

  return (
    <div className="relative">
      <motion.span
        aria-hidden
        className={`absolute inset-y-0 flex items-center text-[var(--color-primary)] pointer-events-none ${
          side === "left" ? "left-1" : "right-1"
        }`}
        style={{ opacity: iconOpacity }}
      >
        <Reply size={16} />
      </motion.span>
      <motion.div
        drag="x"
        dragConstraints={constraints}
        dragElastic={0.3}
        dragMomentum={false}
        style={{ x, touchAction: "pan-y" }}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </div>
  );
}

function AiStreamingBubble({ text, emotion }: { text: string; emotion: Emotion }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 border-l-2 border-[var(--color-arcane)]/50 pl-4 py-1"
    >
      <AiFace emotion={emotion} size={40} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <Markdown text={text} className="text-[var(--color-arcane)]/90 inline" />
        <span className="inline-block w-[2px] h-4 bg-[var(--color-arcane)] ml-0.5 align-middle animate-pulse" />
      </div>
    </motion.div>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex items-center gap-2 text-[var(--color-foreground-subtle)] text-xs pl-1">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)]"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </span>
      {names.join(", ")} {names.length > 1 ? "are" : "is"} typing…
    </div>
  );
}

/* --------------------------------- Input bar -------------------------------- */

function InputBar({
  draft,
  disabled,
  sendLocked,
  onChange,
  onSubmit,
}: {
  draft: string;
  disabled: boolean;
  sendLocked: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex gap-2 max-w-4xl mx-auto items-center">
        <span className="font-mono text-[var(--color-primary)] shrink-0 select-none" aria-hidden>
          &gt;
        </span>
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder={disabled ? "Waiting for more people to join…" : "Say something…"}
          disabled={disabled}
          className="flex-1 rounded-[3px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-3 py-2.5 text-sm font-mono outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/40 transition-shadow duration-150 placeholder:text-[var(--color-foreground-subtle)] disabled:opacity-50"
          autoFocus
        />
        <PixelButton type="submit" disabled={disabled || sendLocked || !draft.trim()} aria-label="Send">
          <Send size={15} />
          <span className="hidden sm:inline">Send</span>
        </PixelButton>
      </div>
    </form>
  );
}
