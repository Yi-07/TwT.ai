"use client";

import { useEffect, useCallback, useRef, useState } from "react";
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

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024;
  });
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024;
  });
  const userToggled = useRef(false);

  const toggleSidebar = useCallback(() => {
    userToggled.current = true;
    setSidebarOpen((v) => !v);
  }, []);

  // Auto-manage sidebar on resize, but only if user never manually toggled
  useEffect(() => {
    const onResize = () => {
      if (userToggled.current) return;
      const narrow = window.innerWidth < 1024;
      setIsNarrow(narrow);
      setSidebarOpen(!narrow);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
  const lastMsg = allMessages.at(-1);

  const hasError = !!error;
  const wasCancelled =
    !isStreaming && !hasError && lastUserMessageRef.current && !rawContent;

  const showRetry =
    !isStreaming && lastUserMessageRef.current;

  // StreamingIndicator shows while waiting for the first chunk
  const waitingForFirstChunk =
    isStreaming &&
    lastMsg?.role === "assistant" &&
    lastMsg.content === "";

  return (
    <div className="flex h-screen overflow-hidden bg-canvas dark:bg-surface-dark">
      {/* Narrow overlay backdrop */}
      {isNarrow && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — inline on wide, overlay on narrow */}
      <aside
        className={`border-r border-hairline bg-canvas-soft dark:border-hairline dark:bg-surface-dark-elevated ${
          isNarrow
            ? `fixed left-0 top-0 z-50 h-full w-64 transition-transform duration-200 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : `shrink-0 transition-all duration-200 ${
                sidebarOpen ? "w-64" : "w-0 overflow-hidden border-r-0"
              }`
        }`}
      >
        <div className="flex h-12 items-center gap-2 border-b border-hairline px-4 dark:border-hairline" style={{ minWidth: 256 }}>
          <span className="text-sm font-semibold tracking-tight text-ink dark:text-on-dark">TwT.ai</span>
        </div>
        <div style={{ minWidth: 256 }}>
          <ConversationList />
        </div>
      </aside>

      {/* Main content */}
      <div className="relative flex min-h-0 flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-4 dark:border-hairline">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-soft opacity-50 transition-opacity hover:opacity-100"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
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

        {/* Error banner */}
        {hasError && (
          <div className="mx-auto mb-2 w-full max-w-3xl rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            Response failed — {error}
            {showRetry && (
              <button onClick={handleRetry} className="ml-2 underline font-medium">
                Retry
              </button>
            )}
          </div>
        )}

        {/* Cancelled banner */}
        {wasCancelled && (
          <div className="mx-auto mb-2 w-full max-w-3xl rounded-lg bg-canvas-soft px-4 py-2 text-sm text-muted dark:bg-surface-dark-elevated dark:text-muted-soft">
            Response cancelled.
            <button onClick={handleRetry} className="ml-2 underline font-medium text-primary hover:text-primary-active">
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
