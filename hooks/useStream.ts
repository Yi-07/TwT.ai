"use client";

import { useState, useRef, useCallback } from "react";
import type { Message } from "@/types/conversation";
import type { ModelOptions } from "@/types/provider";

interface UseStreamOptions {
  providerId: string;
  modelOptions?: ModelOptions;
}

interface UseStreamReturn {
  rawContent: string;
  isStreaming: boolean;
  isSlowResponse: boolean;
  error: string | null;
  send: (messages: Message[]) => void;
  abort: () => void;
}

const SLOW_TIMEOUT_MS = 15_000;

export function useStream(opts: UseStreamOptions): UseStreamReturn {
  const [rawContent, setRawContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSlowResponse, setIsSlowResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSlowTimer = useCallback(() => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    setIsSlowResponse(false);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    clearSlowTimer();
  }, [clearSlowTimer]);

  const send = useCallback(
    (messages: Message[]) => {
      setRawContent("");
      setError(null);
      setIsStreaming(true);
      setIsSlowResponse(false);

      const controller = new AbortController();
      abortRef.current = controller;

      // Start slow-response timer
      clearSlowTimer();
      slowTimerRef.current = setTimeout(() => {
        setIsSlowResponse(true);
      }, SLOW_TIMEOUT_MS);

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          providerId: opts.providerId,
          ...opts.modelOptions,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`API error ${response.status}: ${text}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response body");

          const decoder = new TextDecoder();
          let buffer = "";
          let firstChunk = true;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  if (firstChunk) {
                    firstChunk = false;
                    clearSlowTimer();
                  }
                  setRawContent((prev) => prev + delta);
                }
              } catch {
                // skip unparseable chunks during streaming
              }
            }
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setError(err.message || "Stream failed");
          }
        })
        .finally(() => {
          clearSlowTimer();
          setIsStreaming(false);
          abortRef.current = null;
        });
    },
    [opts.providerId, opts.modelOptions, clearSlowTimer],
  );

  return { rawContent, isStreaming, isSlowResponse, error, send, abort };
}
