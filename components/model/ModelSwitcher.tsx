"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getProviderMetas } from "@/lib/providers/registry";
import { useModelStore } from "@/lib/store/model";

export function ModelSwitcher() {
  const activeModelId = useModelStore((s) => s.activeModelId);
  const setActiveModel = useModelStore((s) => s.setActiveModel);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const providers = getProviderMetas();
  const activeProvider = providers.find((p) => p.id === activeModelId);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-body transition-colors hover:bg-canvas-soft dark:text-on-dark dark:hover:bg-surface-dark-elevated"
      >
        {activeProvider?.name ?? "Select model"}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-hairline bg-canvas py-1 shadow-lg dark:border-hairline dark:bg-surface-dark">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActiveModel(p.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-canvas-soft dark:hover:bg-surface-dark-elevated ${
                p.id === activeModelId
                  ? "font-medium text-ink dark:text-on-dark"
                  : "text-muted dark:text-on-dark-soft"
              }`}
            >
              {p.name}
              {p.id === activeModelId && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
