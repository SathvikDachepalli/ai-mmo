"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AdminRoom {
  id: string;
  code: string;
  name: string;
  status: "waiting" | "active" | "closed";
  min_players: number;
  host_email: string;
  member_count: number;
  online_count: number;
  created_at: string;
}

export async function listAllRooms(token: string, limit: number, offset: number): Promise<AdminRoom[]> {
  const res = await fetch(`${API}/admin/rooms?limit=${limit}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not load rooms (are you an admin?)");
  return res.json();
}

export async function deleteRoom(token: string, roomId: string): Promise<void> {
  const res = await fetch(`${API}/admin/rooms/${roomId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not delete room");
}
