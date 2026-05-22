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
  const pendingRef = useRef("");
  const rafRef = useRef(0);

  const clearSlowTimer = useCallback(() => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    setIsSlowResponse(false);
  }, []);

  const flushPending = useCallback(() => {
    if (pendingRef.current) {
      setRawContent((prev) => prev + pendingRef.current);
      pendingRef.current = "";
    }
    rafRef.current = 0;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    clearSlowTimer();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, [clearSlowTimer]);

  const send = useCallback(
    (messages: Message[]) => {
      setRawContent("");
      pendingRef.current = "";
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
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
                  pendingRef.current += delta;
                  if (!rafRef.current) {
                    rafRef.current = requestAnimationFrame(() => flushPending());
                  }
                }
              } catch {
                // skip unparseable chunks during streaming
              }
            }
          }

          // Flush any remaining pending content
          flushPending();
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setError(err.message || "Stream failed");
          }
        })
        .finally(() => {
          clearSlowTimer();
          flushPending();
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = 0;
          }
          setIsStreaming(false);
          abortRef.current = null;
        });
    },
    [opts.providerId, opts.modelOptions, clearSlowTimer, flushPending],
  );

  return { rawContent, isStreaming, isSlowResponse, error, send, abort };
}
