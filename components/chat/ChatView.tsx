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
    createAssistantMessage,
    updateAssistantMessage,
  } = useConversation();

  const activeModelId = useModelStore((s) => s.activeModelId);
  const settings = useModelStore((s) => s.modelSettings[activeModelId]);

  const { rawContent, isStreaming, isSlowResponse, error, send, abort } =
    useStream({
      providerId: activeModelId,
      modelOptions: settings,
    });

  const lastUserMessageRef = useRef<string>("");
  const assistantMsgIdRef = useRef<string>("");

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

  // Sync streaming content into the store so the same Message key
  // persists from pre-stream through streaming to post-stream —
  // no iframe is ever unmounted/remounted.
  useEffect(() => {
    const msgId = assistantMsgIdRef.current;
    const cId = activeId;
    if (msgId && cId && cId !== "new") {
      updateAssistantMessage(cId, msgId, rawContent);
    }
  }, [rawContent, activeId, updateAssistantMessage]);

  const handleSend = useCallback(
    (content: string) => {
      lastUserMessageRef.current = content;

      const cId = sendMessage(content);
      if (cId !== activeId) {
        router.replace(`/c/${cId}`);
      }

      // Create an empty assistant message before streaming starts.
      // Its id stays stable through the entire stream lifecycle.
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      assistantMsgIdRef.current = msgId;
      createAssistantMessage(cId, msgId);

      const { conversations } = useConversationStore.getState();
      const conv = conversations.find((c) => c.id === cId);
      const messages = (conv?.messages ?? []).filter(
        (m) => m.content.trim() !== "",
      );

      send(messages);
    },
    [
      sendMessage,
      activeId,
      createAssistantMessage,
      send,
      router,
    ],
  );

  const handleRetry = useCallback(() => {
    const content = lastUserMessageRef.current;
    if (!content) return;
    handleSend(content);
  }, [handleSend]);

  const handleSendPrompt = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend],
  );

  const allMessages = active?.messages ?? [];
  const showRetry =
    !isStreaming &&
    (error || (lastUserMessageRef.current && !rawContent)) &&
    lastUserMessageRef.current;

  // Streaming starts with content="" so the first chunk is visible
  // as soon as it arrives. StreamingIndicator shows while waiting.
  const lastMsg = allMessages.at(-1);
  const waitingForFirstChunk =
    isStreaming &&
    lastMsg?.role === "assistant" &&
    lastMsg.content === "";

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
      <div className="relative flex min-h-0 flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ModelSwitcher />
          </div>
          <ModelSettings />
        </div>

        {/* Messages */}
        <MessageList
          messages={allMessages}
          isStreaming={waitingForFirstChunk}
          isSlow={isSlowResponse}
          onSendPrompt={handleSendPrompt}
        />

        {/* Error / retry banner */}
        {error && (
          <div className="mx-auto mb-2 w-full max-w-3xl rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
            <button onClick={handleRetry} className="ml-2 underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Retry after cancel */}
        {showRetry && !error && (
          <div className="mx-auto mb-2 w-full max-w-3xl px-4">
            <button
              onClick={handleRetry}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Input */}
        <InputBar
          onSend={handleSend}
          onStop={abort}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
