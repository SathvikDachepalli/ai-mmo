"use client";

import { create } from "zustand";

export interface ReplyPreview {
  id: string;
  authorName: string;
  body: string;
}

export type Emotion =
  | "neutral" | "happy" | "thinking" | "confused" | "angry" | "mad" | "sad" | "crying"
  | "surprised" | "excited" | "worried" | "blushing" | "shy" | "sleepy" | "smirk" | "pouting";

export interface ChatEntry {
  id: string;
  kind: "message" | "system" | "ai";
  authorId: string | null;
  author: string;
  text: string;
  replyTo: ReplyPreview | null;
  /** Only set for kind "ai" — the expression detected for this reply. */
  emotion?: Emotion;
}

export interface Member {
  userId: string;
  displayName: string;
  isOnline: boolean;
  isHost: boolean;
}

export interface RoomState {
  code: string;
  name: string;
  status: "waiting" | "active" | "closed";
  minPlayers: number;
  maxPlayers: number;
  systemPrompt: string;
  hostUserId: string;
  userId: string;
  connected: boolean;
  closed: boolean;
  members: Member[];
  typing: string[];
  entries: ChatEntry[];
  hasMoreHistory: boolean;
  oldestMessageId: string | null;
  loadingOlder: boolean;
  aiStreaming: boolean;
  aiDraft: string;
  aiEmotion: Emotion;
  replyDraft: ReplyPreview | null;
  lastError: string;
  reset: () => void;
  setConnected: (v: boolean) => void;
  setUserId: (v: string) => void;
  setRoomJoined: (d: {
    code: string;
    name: string;
    status: string;
    min_players: number;
    max_players: number;
    system_prompt: string;
    host_user_id: string;
    members: { user_id: string; display_name: string; is_online: boolean; is_host: boolean }[];
    history: {
      id: string;
      user_id: string | null;
      author_name: string;
      kind: string;
      body: string;
      reply_to: { id: string; author_name: string; body: string } | null;
      emotion?: string | null;
    }[];
    has_more_history: boolean;
  }) => void;
  setLoadingOlder: (v: boolean) => void;
  prependHistory: (
    rows: {
      id: string;
      user_id: string | null;
      author_name: string;
      kind: string;
      body: string;
      reply_to: { id: string; author_name: string; body: string } | null;
      emotion?: string | null;
    }[],
    hasMore: boolean
  ) => void;
  setPresence: (members: { user_id: string; display_name: string; is_online: boolean }[]) => void;
  setTyping: (name: string, on: boolean) => void;
  pushSystem: (text: string) => void;
  pushMessage: (e: {
    id: string;
    user_id: string | null;
    author_name: string;
    kind: string;
    body: string;
    reply_to: { id: string; author_name: string; body: string } | null;
    emotion?: string;
  }) => void;
  startAiStream: () => void;
  appendAiStream: (delta: string) => void;
  setAiEmotion: (e: Emotion) => void;
  endAiStream: () => void;
  setReplyDraft: (v: ReplyPreview | null) => void;
  setClosed: () => void;
  setSystemPrompt: (v: string) => void;
  setError: (m: string) => void;
}

const initial = {
  code: "",
  name: "",
  status: "waiting" as const,
  minPlayers: 2,
  maxPlayers: 10,
  systemPrompt: "",
  hostUserId: "",
  userId: "",
  connected: false,
  closed: false,
  members: [] as Member[],
  typing: [] as string[],
  entries: [] as ChatEntry[],
  hasMoreHistory: false,
  oldestMessageId: null as string | null,
  loadingOlder: false,
  aiStreaming: false,
  aiDraft: "",
  aiEmotion: "neutral" as Emotion,
  replyDraft: null as ReplyPreview | null,
  lastError: "",
};

function toReplyPreview(r: { id: string; author_name: string; body: string } | null): ReplyPreview | null {
  return r ? { id: r.id, authorName: r.author_name, body: r.body } : null;
}

const VALID_EMOTIONS = new Set<Emotion>([
  "neutral", "happy", "thinking", "confused", "angry", "mad", "sad", "crying",
  "surprised", "excited", "worried", "blushing", "shy", "sleepy", "smirk", "pouting",
]);

function toEmotion(e: string | undefined): Emotion {
  return e && VALID_EMOTIONS.has(e as Emotion) ? (e as Emotion) : "neutral";
}

export const useRoom = create<RoomState>((set) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setConnected: (v) => set({ connected: v }),
  setUserId: (v) => set({ userId: v }),
  setRoomJoined: (d) =>
    set({
      code: d.code,
      name: d.name,
      status: d.status as RoomState["status"],
      minPlayers: d.min_players,
      maxPlayers: d.max_players,
      systemPrompt: d.system_prompt,
      hostUserId: d.host_user_id,
      members: d.members.map((m) => ({
        userId: m.user_id,
        displayName: m.display_name,
        isOnline: m.is_online,
        isHost: m.is_host,
      })),
      entries: d.history.map((m) => ({
        id: m.id,
        kind: (m.kind === "system" ? "system" : m.kind === "ai" ? "ai" : "message") as ChatEntry["kind"],
        authorId: m.user_id,
        author: m.author_name,
        text: m.body,
        replyTo: toReplyPreview(m.reply_to),
        emotion: m.kind === "ai" ? toEmotion(m.emotion ?? undefined) : undefined,
      })),
      hasMoreHistory: d.has_more_history,
      oldestMessageId: d.history.length > 0 ? d.history[0].id : null,
    }),
  setLoadingOlder: (v) => set({ loadingOlder: v }),
  prependHistory: (rows, hasMore) =>
    set((s) => ({
      entries: [
        ...rows.map((m) => ({
          id: m.id,
          kind: (m.kind === "system" ? "system" : m.kind === "ai" ? "ai" : "message") as ChatEntry["kind"],
          authorId: m.user_id,
          author: m.author_name,
          text: m.body,
          replyTo: toReplyPreview(m.reply_to),
          emotion: m.kind === "ai" ? toEmotion(m.emotion ?? undefined) : undefined,
        })),
        ...s.entries,
      ],
      hasMoreHistory: hasMore,
      oldestMessageId: rows.length > 0 ? rows[0].id : s.oldestMessageId,
    })),
  setPresence: (members) =>
    set((s) => ({
      members: members.map((m) => {
        const prev = s.members.find((p) => p.userId === m.user_id);
        return {
          userId: m.user_id,
          displayName: m.display_name,
          isOnline: m.is_online,
          isHost: prev?.isHost ?? false,
        };
      }),
    })),
  setTyping: (name, on) =>
    set((s) => ({
      typing: on ? Array.from(new Set([...s.typing, name])) : s.typing.filter((n) => n !== name),
    })),
  pushSystem: (text) =>
    set((s) => ({
      entries: [
        ...s.entries,
        { id: crypto.randomUUID(), kind: "system", authorId: null, author: "System", text, replyTo: null },
      ],
    })),
  pushMessage: (e) =>
    set((s) => ({
      entries: [
        ...s.entries,
        {
          id: e.id,
          kind: (e.kind === "ai" ? "ai" : "message") as ChatEntry["kind"],
          authorId: e.user_id,
          author: e.author_name,
          text: e.body,
          replyTo: toReplyPreview(e.reply_to),
          emotion: e.kind === "ai" ? toEmotion(e.emotion) : undefined,
        },
      ],
      // The final AI message has landed; stop showing the live-growing draft.
      aiDraft: e.kind === "ai" ? "" : s.aiDraft,
    })),
  startAiStream: () => set({ aiStreaming: true, aiDraft: "", aiEmotion: "neutral" }),
  appendAiStream: (delta) => set((s) => ({ aiDraft: s.aiDraft + delta })),
  setAiEmotion: (e) => set({ aiEmotion: e }),
  endAiStream: () => set({ aiStreaming: false, aiDraft: "" }),
  setReplyDraft: (v) => set({ replyDraft: v }),
  setClosed: () => set({ closed: true }),
  setSystemPrompt: (v) => set({ systemPrompt: v }),
  setError: (m) => set({ lastError: m }),
}));

// Standalone action helpers for non-component code (socket layer) to call.
export const setConnected = useRoom.getState().setConnected.bind(useRoom);
export const setUserId = useRoom.getState().setUserId.bind(useRoom);
export const setRoomJoined = useRoom.getState().setRoomJoined.bind(useRoom);
export const setPresence = useRoom.getState().setPresence.bind(useRoom);
export const setTyping = useRoom.getState().setTyping.bind(useRoom);
export const pushSystem = useRoom.getState().pushSystem.bind(useRoom);
export const pushMessage = useRoom.getState().pushMessage.bind(useRoom);
export const startAiStream = useRoom.getState().startAiStream.bind(useRoom);
export const appendAiStream = useRoom.getState().appendAiStream.bind(useRoom);
export const setAiEmotion = useRoom.getState().setAiEmotion.bind(useRoom);
export const endAiStream = useRoom.getState().endAiStream.bind(useRoom);
export const setClosed = useRoom.getState().setClosed.bind(useRoom);
export const setSystemPrompt = useRoom.getState().setSystemPrompt.bind(useRoom);
export const setError = useRoom.getState().setError.bind(useRoom);
