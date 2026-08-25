"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ModelsState {
  current_model: string;
  provider: string;
  live: boolean;
  models: ModelOption[];
}

export async function fetchModels(token: string): Promise<ModelsState> {
  const res = await fetch(`${API}/ai/models`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not load models");
  return res.json();
}

export async function selectModel(token: string, modelId: string): Promise<void> {
  const res = await fetch(`${API}/ai/models/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model_id: modelId }),
  });
  if (!res.ok) throw new Error("Model switch failed");
}
