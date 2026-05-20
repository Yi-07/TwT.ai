"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import { useStream } from "@/hooks/useStream";
import { useModelStore } from "@/lib/store/model";
import { useConversationStore } from "@/lib/store/conversation";
import { ConversationList } from "@/components/sidebar/ConversationList";
import { ModelSwitcher } from "@/components/model/ModelSwitcher";
import { ModelSettings } from "@/components/model/ModelSettings";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";

interface ChatViewProps {
  conversationId: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const router = useRouter();
  const initialized = useRef(false);

  const {
    active,
    activeId,
    createConversation,
    sendMessage,
    appendAssistantMessage,
  } = useConversation();

  const activeModelId = useModelStore((s) => s.activeModelId);
  const settings = useModelStore((s) => s.modelSettings[activeModelId]);

  const { rawContent, isStreaming, error, send, abort } = useStream({
    providerId: activeModelId,
    modelOptions: settings,
  });

  // Handle "new" conversation: create one and redirect
  useEffect(() => {
    if (conversationId === "new" && !initialized.current) {
      initialized.current = true;
      const id = createConversation(activeModelId);
      router.replace(`/c/${id}`);
    }
  }, [conversationId, activeModelId, createConversation, router]);

  // Sync URL when user switches conversations via sidebar
  useEffect(() => {
    if (activeId && activeId !== conversationId && activeId !== "new") {
      router.replace(`/c/${activeId}`);
    }
  }, [activeId, conversationId, router]);

  // When streaming completes, append assistant message
  const prevStreaming = useRef(isStreaming);
  const contentRef = useRef(rawContent);
  contentRef.current = rawContent;

  useEffect(() => {
    if (prevStreaming.current && !isStreaming && contentRef.current && !error) {
      const cId = activeId;
      if (cId && cId !== "new") {
        appendAssistantMessage(cId, contentRef.current);
      }
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, error, activeId, appendAssistantMessage]);

  const handleSend = useCallback(
    (content: string) => {
      const cId = sendMessage(content);
      if (cId !== activeId) {
        router.replace(`/c/${cId}`);
      }

      const { conversations } = useConversationStore.getState();
      const conv = conversations.find((c) => c.id === cId);
      const messages = conv?.messages ?? [];

      send(messages);
    },
    [sendMessage, activeId, send, router],
  );

  const allMessages = active?.messages ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-black">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 md:flex md:flex-col dark:border-zinc-800">
        <div className="flex h-12 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <span className="text-sm font-semibold tracking-tight">TwT.ai</span>
        </div>
        <ConversationList />
      </aside>

      {/* Main content */}
      <div className="relative flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ModelSwitcher />
          </div>
          <ModelSettings />
        </div>

        {/* Messages */}
        <MessageList
          messages={
            isStreaming && rawContent
              ? [
                  ...allMessages,
                  {
                    id: "streaming",
                    role: "assistant" as const,
                    content: rawContent,
                    createdAt: Date.now(),
                  },
                ]
              : allMessages
          }
          isStreaming={isStreaming}
        />

        {/* Error banner */}
        {error && (
          <div className="mx-auto mb-2 w-full max-w-3xl rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
            <button
              onClick={() => abort()}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input */}
        <InputBar onSend={handleSend} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
