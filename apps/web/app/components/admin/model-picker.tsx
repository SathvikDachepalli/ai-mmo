"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";

import { getToken } from "../../lib/auth";
import { fetchModels, selectModel, type ModelOption, type ModelsState } from "../../lib/ai";

/** OpenRouter ships ~400 models, so this is a search box over the live catalog
 * rather than a list of buttons. Only a slice is rendered — mounting hundreds
 * of rows to show ten is what makes pickers like this feel slow. */
const VISIBLE_LIMIT = 40;

function formatPrice(model: ModelOption): string {
  if (model.is_free) return "free";
  if (model.prompt_price === null) return "—";
  // Catalog prices are per token; per-million is the unit people quote.
  const perMillion = model.prompt_price * 1_000_000;
  return `$${perMillion < 1 ? perMillion.toFixed(2) : perMillion.toFixed(0)}/M in`;
}

function formatContext(tokens: number): string {
  if (!tokens) return "";
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}K ctx` : `${tokens} ctx`;
}

export function ModelPicker() {
  const [state, setState] = useState<ModelsState | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetchModels(token)
      .then(setState)
      .catch((err) => setError((err as Error).message));
  }, []);

  const load = async (refresh = false) => {
    const token = getToken();
    if (!token || inFlight.current) return;
    inFlight.current = true;
    if (refresh) setRefreshing(true);
    try {
      setState(await fetchModels(token, refresh));
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  };

  const switchModel = async (modelId: string) => {
    const token = getToken();
    if (!token || switching || modelId === state?.current_model) return;
    setSwitching(modelId);
    setError("");
    try {
      await selectModel(token, modelId);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSwitching(null);
    }
  };

  const { shown, total } = useMemo(() => {
    const all = state?.models ?? [];
    const q = query.trim().toLowerCase();
    const matched = all.filter(
      (m) =>
        (!freeOnly || m.is_free) &&
        (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    );
    // The model in use stays visible even when it doesn't match the filter,
    // so you can always see what you're switching away from.
    const current = all.find((m) => m.id === state?.current_model);
    const slice = matched.slice(0, VISIBLE_LIMIT);
    if (current && !slice.some((m) => m.id === current.id)) slice.unshift(current);
    return { shown: slice, total: matched.length };
  }, [state, query, freeOnly]);

  return (
    <div className="flex flex-col gap-2 rounded-[3px] border border-[var(--color-border)] p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        <Sparkles size={13} className="text-[var(--color-arcane)]" />
        AI model
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          title="Re-fetch the OpenRouter catalog"
          className="ml-auto flex items-center gap-1 font-mono text-[11px] normal-case text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-foreground)] cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {state ? (
        <p className="font-mono text-[11px] text-[var(--color-muted)]">
          <span className={state.live ? "text-[var(--color-arcane)]" : ""}>
            {state.live ? `live · ${state.provider}` : "deterministic (no API key)"}
          </span>
          {state.stale ? (
            <span className="text-[var(--color-accent)]"> · catalog offline, list may be out of date</span>
          ) : null}
        </p>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-accent)]">{error}</p> : null}

      {state ? (
        <>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5">
              <Search size={13} className="shrink-0 text-[var(--color-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 400+ models…"
                className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-[var(--color-foreground-subtle)]"
              />
            </label>
            <button
              onClick={() => setFreeOnly((v) => !v)}
              aria-pressed={freeOnly}
              className={`shrink-0 rounded-[3px] border px-2.5 py-2 font-mono text-[11px] uppercase transition-colors duration-150 cursor-pointer ${
                freeOnly
                  ? "border-[var(--color-arcane)] bg-[var(--color-arcane)]/10 text-[var(--color-arcane)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              Free only
            </button>
          </div>

          <div className="ember-scroll flex max-h-[280px] flex-col gap-1 overflow-y-auto">
            {shown.map((m) => {
              const active = m.id === state.current_model;
              return (
                <button
                  key={m.id}
                  onClick={() => switchModel(m.id)}
                  disabled={switching !== null}
                  className={`flex items-center gap-2 rounded-[3px] px-3 py-2 text-left text-sm transition-colors duration-150 cursor-pointer disabled:cursor-default ${
                    active
                      ? "border border-[var(--color-arcane)]/40 bg-[var(--color-arcane)]/10 text-[var(--color-foreground)]"
                      : "border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  <span className="w-4 shrink-0">
                    {switching === m.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : active ? (
                      <Check size={13} className="text-[var(--color-arcane)]" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.name}</span>
                    <span className="block truncate font-mono text-[10px] text-[var(--color-foreground-subtle)]">
                      {m.id}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[10px] text-[var(--color-muted)]">
                    <span className={m.is_free ? "text-[var(--color-arcane)]" : ""}>{formatPrice(m)}</span>
                    <span className="block">{formatContext(m.context_length)}</span>
                  </span>
                </button>
              );
            })}

            {/* Keyed off the match count, not the rendered count: the model in
              * use is pinned into the list, so `shown` is never empty and this
              * would otherwise never appear. */}
            {total === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[var(--color-muted)]">
                Nothing else matches “{query.trim()}”.
              </p>
            ) : null}
          </div>

          {total > VISIBLE_LIMIT ? (
            <p className="font-mono text-[11px] text-[var(--color-foreground-subtle)]">
              Showing {VISIBLE_LIMIT} of {total} matches — narrow the search to see more.
            </p>
          ) : null}
        </>
      ) : (
        <Loader2 size={14} className="animate-spin text-[var(--color-muted)]" />
      )}
    </div>
  );
}
