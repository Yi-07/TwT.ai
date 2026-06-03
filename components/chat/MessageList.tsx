"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Message } from "@/types/conversation";
import { useConversationStore } from "@/lib/store/conversation";
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
  const nearBottomRef = useRef(true);

  const isNearBottom = useCallback(() => {
    const c = containerRef.current;
    if (!c) return true;
    return c.scrollTop + c.clientHeight >= c.scrollHeight - 80;
  }, []);

  const scrollToBottom = () => {
    if (!nearBottomRef.current) return;
    const c = containerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  };

  // Track whether the user is near the bottom.  Upward scroll stops
  // auto-follow; scrolling back to the bottom resumes it immediately.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onScroll = () => {
      nearBottomRef.current = isNearBottom();
    };
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => c.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  // Immediate scroll on each content update
  useEffect(() => {
    scrollToBottom();
  });

  // Polling + ResizeObserver — catch async layout (code blocks, tables, iframes).
  // Decoupled from [messages] so the interval isn't reset every ~16ms.
  useEffect(() => {
    if (!streaming) return;
    const container = containerRef.current;
    if (!container) return;

    // ResizeObserver on the inner wrapper catches height changes from
    // Markdown/code-block layout that happen after React commit.
    const wrapper = container.firstElementChild;
    const ro = new ResizeObserver(() => scrollToBottom());
    if (wrapper) ro.observe(wrapper);

    const interval = setInterval(scrollToBottom, 120);
    return () => {
      clearInterval(interval);
      ro.disconnect();
    };
  }, [streaming]);

  // Scroll to bottom on first mount regardless
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  const hasHydrated = useConversationStore((s) => s._hasHydrated);

  if (messages.length === 0 && !streaming && hasHydrated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-soft dark:text-on-dark-soft">Start a conversation</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-scroll-container
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
