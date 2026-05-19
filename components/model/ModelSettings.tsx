"use client";

import { useState, useCallback } from "react";
import { useModelStore } from "@/lib/store/model";

export function ModelSettings() {
  const [open, setOpen] = useState(false);
  const activeModelId = useModelStore((s) => s.activeModelId);
  const modelSettings = useModelStore((s) => s.modelSettings);
  const updateModelSettings = useModelStore((s) => s.updateModelSettings);

  const settings = modelSettings[activeModelId] ?? {};
  const temperature = settings.temperature ?? 1;
  const maxTokens = settings.maxTokens ?? 4096;
  const systemPrompt = settings.systemPrompt ?? "";

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      updateModelSettings(activeModelId, patch);
    },
    [activeModelId, updateModelSettings],
  );

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Settings
      </button>

      {open && (
        <div className="absolute right-4 top-12 z-50 w-80 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Temperature: {temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-zinc-400">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Max tokens
            </label>
            <input
              type="number"
              min={1}
              max={200000}
              value={maxTokens}
              onChange={(e) =>
                update({ maxTokens: parseInt(e.target.value, 10) || 4096 })
              }
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              System prompt
            </label>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => update({ systemPrompt: e.target.value })}
              placeholder="Optional system instructions..."
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
