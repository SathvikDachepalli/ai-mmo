"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface RoomMember {
  user_id: string;
  display_name: string;
  is_online: boolean;
  is_host: boolean;
}

export interface RoomInfo {
  id: string;
  code: string;
  name: string;
  status: "waiting" | "active" | "closed";
  min_players: number;
  max_players: number;
  system_prompt: string;
  host_user_id: string;
  members: RoomMember[];
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : "Request failed");
  }
  return res.json();
}

export interface CreateRoomOptions {
  minPlayers?: number;
  maxPlayers?: number;
  systemPrompt?: string;
}

export async function createRoom(token: string, name: string, opts: CreateRoomOptions = {}): Promise<RoomInfo> {
  const res = await fetch(`${API}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name,
      min_players: opts.minPlayers ?? 1,
      max_players: opts.maxPlayers ?? 10,
      system_prompt: opts.systemPrompt ?? "",
    }),
  });
  return unwrap<RoomInfo>(res);
}

/** Host-only: update the room's AI rules. */
export async function updateRoomPrompt(token: string, code: string, systemPrompt: string): Promise<RoomInfo> {
  const res = await fetch(`${API}/rooms/${code}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ system_prompt: systemPrompt }),
  });
  return unwrap<RoomInfo>(res);
}

/** Host-only: adds another account to the room by email -- it shows up in
 * their "my rooms" list the next time they log in, no code needed. */
export async function inviteToRoom(token: string, code: string, email: string): Promise<RoomInfo> {
  const res = await fetch(`${API}/rooms/${code}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email }),
  });
  return unwrap<RoomInfo>(res);
}

export async function joinRoom(token: string, code: string): Promise<RoomInfo> {
  const res = await fetch(`${API}/rooms/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  return unwrap<RoomInfo>(res);
}

export async function getRoom(token: string, code: string): Promise<RoomInfo> {
  const res = await fetch(`${API}/rooms/${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<RoomInfo>(res);
}

/** Host-only: permanently deletes the room and its full history. */
export async function deleteRoomByCode(token: string, code: string): Promise<void> {
  const res = await fetch(`${API}/rooms/${code}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : "Could not delete room");
  }
}

export interface MyRoom {
  code: string;
  name: string;
  status: "waiting" | "active" | "closed";
  member_count: number;
  is_host: boolean;
  last_activity_at: string;
}

export async function getMyRooms(token: string, limit: number, offset: number): Promise<MyRoom[]> {
  const res = await fetch(`${API}/rooms/mine?limit=${limit}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<MyRoom[]>(res);
}

export interface ReplyPreviewOut {
  id: string;
  author_name: string;
  body: string;
}

export interface MessageOut {
  id: string;
  author_name: string;
  user_id: string | null;
  kind: string;
  body: string;
  reply_to: ReplyPreviewOut | null;
  emotion?: string | null;
}

export interface MessagesPage {
  messages: MessageOut[];
  has_more: boolean;
}

/** Omit `before` for the latest page; pass the oldest currently-shown
 * message id to fetch the page before it (scroll-up pagination). */
export async function getMessages(
  token: string,
  code: string,
  opts: { before?: string; limit?: number } = {}
): Promise<MessagesPage> {
  const params = new URLSearchParams();
  if (opts.before) params.set("before", opts.before);
  params.set("limit", String(opts.limit ?? 30));
  const res = await fetch(`${API}/rooms/${code}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<MessagesPage>(res);
}
