"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";

interface InputBarProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

export function InputBar({ onSend, onStop, isStreaming }: InputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isStreaming) {
          handleSend();
        }
      }
    },
    [handleSend, isStreaming],
  );

  return (
    <div className="shrink-0 border-t border-hairline bg-canvas-soft dark:border-hairline dark:bg-surface-dark">
      <div className="mx-auto flex max-w-3xl items-end gap-3 px-4 py-4">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-hairline bg-canvas px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none dark:border-hairline dark:bg-surface-dark-elevated dark:text-on-dark dark:placeholder:text-on-dark-soft dark:focus:border-primary"
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-dark text-on-dark transition-colors hover:bg-red-600 hover:text-white dark:bg-on-dark dark:text-surface-dark dark:hover:bg-red-500 dark:hover:text-white"
            aria-label="Stop generating"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-30 dark:bg-primary dark:hover:bg-primary-active"
            aria-label="Send message"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
