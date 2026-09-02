"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : "Request failed");
  }
  return res.json();
}

export interface RequestJoinResult {
  request_id: string;
  status: "pending" | "approved" | "denied";
}

/** Name+code guest entry: no account, just a name and a room code. */
export async function requestJoin(code: string, name: string): Promise<RequestJoinResult> {
  const res = await fetch(`${API}/rooms/${code.trim().toUpperCase()}/request-join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return unwrap<RequestJoinResult>(res);
}

export interface JoinStatus {
  status: "pending" | "approved" | "denied";
  token?: string;
  display_name?: string;
}

export async function pollJoinStatus(code: string, requestId: string): Promise<JoinStatus> {
  const res = await fetch(`${API}/rooms/${code.trim().toUpperCase()}/request-join/${requestId}`);
  return unwrap<JoinStatus>(res);
}

export interface PendingRequest {
  request_id: string;
  name: string;
  created_at: string;
}

export async function listPending(token: string, code: string): Promise<PendingRequest[]> {
  const res = await fetch(`${API}/rooms/${code}/pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<PendingRequest[]>(res);
}

/** Host: let a pending guest in. */
export async function approveRequest(token: string, code: string, requestId: string): Promise<void> {
  const res = await fetch(`${API}/rooms/${code}/request-join/${requestId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not approve");
}

/** Host: deny a pending guest and block that name from asking again. */
export async function denyRequest(token: string, code: string, requestId: string): Promise<void> {
  const res = await fetch(`${API}/rooms/${code}/request-join/${requestId}/deny`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not block");
}

/** Host: remove a current member and block them from rejoining. */
export async function banMember(token: string, code: string, userId: string): Promise<void> {
  const res = await fetch(`${API}/rooms/${code}/members/${userId}/ban`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not ban");
}
