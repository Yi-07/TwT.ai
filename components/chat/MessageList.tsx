"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/types/conversation";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  streaming?: boolean;
  isSlow: boolean;
  onSendPrompt?: (text: string) => void;
  onEditSubmit?: (msgId: string, newText: string) => void;
  onRetry?: () => void;
}

export function MessageList({
  messages,
  streaming,
  isSlow,
  onSendPrompt,
  onEditSubmit,
  onRetry,
}: MessageListProps) {

  const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollToBottom = () => {
      const threshold = 80;
      const isNearBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - threshold;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    };

    scrollToBottom();

    // During streaming, poll periodically to catch async height changes
    // (artifact iframe resize via postMessage, Markdown re-layout, etc.)
    if (streaming) {
      const interval = setInterval(scrollToBottom, 120);
      return () => clearInterval(interval);
    }
  }, [messages, streaming]);

  // Scroll to bottom on first mount regardless
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-soft dark:text-on-dark-soft">Start a conversation</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            streaming={streaming}
            isSlow={isSlow}
            onSendPrompt={onSendPrompt}
            isLastUserMsg={i === messages.length - 1 - lastUserIdx}
            onEditSubmit={onEditSubmit}
            onRetry={onRetry}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
