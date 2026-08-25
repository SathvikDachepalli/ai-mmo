"use client";

import { io, Socket } from "socket.io-client";

import {
  setConnected,
  setRoomJoined,
  setPresence,
  setTyping,
  pushSystem,
  pushMessage,
  startAiStream,
  appendAiStream,
  setAiEmotion,
  endAiStream,
  setClosed,
  setSystemPrompt,
  setError,
} from "./store";

let socket: Socket | null = null;

export function connectToRoom(
  url: string,
  code: string,
  token: string,
  onClosed?: () => void
): void {
  socket = io(url, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    auth: { code, token },
  });

  socket.on("connect", () => setConnected(true));
  socket.on("disconnect", () => setConnected(false));
  socket.on("connect_error", (err) => setError((err as Error).message ?? "connection failed"));

  socket.on("room_joined", (d) => setRoomJoined(d));
  socket.on("presence_update", (d) => setPresence(d.members ?? []));

  socket.on("member_joined", (d) => pushSystem(`${d.display_name} joined the room.`));
  socket.on("member_left", (d) => {
    pushSystem(`${d.display_name} left the room.`);
    setTyping(d.display_name, false);
  });

  socket.on("player_typing", (d) => setTyping(d.name, !!d.typing));

  socket.on("chat_message", (d) => pushMessage(d));

  socket.on("ai_stream_start", () => startAiStream());
  socket.on("ai_stream_chunk", (d) => appendAiStream(d.delta ?? ""));
  socket.on("ai_emotion", (d) => setAiEmotion(d.emotion ?? "neutral"));
  socket.on("ai_stream_end", () => endAiStream());

  socket.on("room_closed", () => {
    setClosed();
    pushSystem("This room has been closed.");
    onClosed?.();
  });

  socket.on("room_settings_updated", (d) => {
    setSystemPrompt(d.system_prompt ?? "");
    pushSystem("The host updated this room's rules.");
  });

  socket.on("error", (d) => setError(d.detail ?? d.message ?? "something's wrong"));
}

export function sendMessage(text: string, replyToId?: string | null): void {
  socket?.emit("chat_message", { text, reply_to: replyToId ?? undefined });
}

export function sendTyping(on: boolean): void {
  socket?.emit("typing", { typing: on });
}

export function endRoom(): void {
  socket?.emit("end_room", {});
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
}
