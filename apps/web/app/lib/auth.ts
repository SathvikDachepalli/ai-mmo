"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "rpg_token";
const NAME_KEY = "rpg_name";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  is_superuser: boolean;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getSavedName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NAME_KEY);
}

export async function register(email: string, password: string, displayName: string): Promise<AuthUser> {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName || email.split("@")[0] }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ? JSON.stringify(body.detail) : "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API}/auth/jwt/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Invalid email or password");
  const data = await res.json();
  window.localStorage.setItem(TOKEN_KEY, data.access_token);
  return data.access_token as string;
}

export async function me(token: string): Promise<AuthUser> {
  const res = await fetch(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Session expired");
  return res.json();
}

export function saveName(name: string): void {
  window.localStorage.setItem(NAME_KEY, name);
}

export function logout(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
