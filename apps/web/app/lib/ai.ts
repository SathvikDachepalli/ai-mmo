"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ModelOption {
  id: string;
  name: string;
  context_length: number;
  /** USD per token. Null when the catalog didn't report a price. */
  prompt_price: number | null;
  completion_price: number | null;
  is_free: boolean;
}

export interface ModelsState {
  current_model: string;
  provider: string;
  live: boolean;
  /** True when the OpenRouter catalog couldn't be refreshed and this list is
   *  a cached or fallback copy. */
  stale: boolean;
  models: ModelOption[];
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : fallback);
  }
  return res.json();
}

export async function fetchModels(token: string, refresh = false): Promise<ModelsState> {
  const res = await fetch(`${API}/ai/models${refresh ? "?refresh=true" : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<ModelsState>(res, "Could not load models");
}

export async function selectModel(token: string, modelId: string): Promise<void> {
  const res = await fetch(`${API}/ai/models/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model_id: modelId }),
  });
  await unwrap(res, "Model switch failed");
}
