"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/types/conversation";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use scrollTop on the scrollable container directly.
    // Instant scroll avoids overlapping smooth animations from
    // rapid-fire SSE chunks during streaming.
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  // Scroll to bottom on first mount regardless
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-400">Start a conversation</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && <StreamingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
