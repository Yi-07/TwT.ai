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
  error: string | null;
  send: (messages: Message[]) => void;
  abort: () => void;
}

export function useStream(opts: UseStreamOptions): UseStreamReturn {
  const [rawContent, setRawContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    (messages: Message[]) => {
      setRawContent("");
      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

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
          setIsStreaming(false);
          abortRef.current = null;
        });
    },
    [opts.providerId, opts.modelOptions],
  );

  return { rawContent, isStreaming, error, send, abort };
}
