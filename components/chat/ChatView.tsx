"use client";

import { useEffect, useLayoutEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import { useStream } from "@/hooks/useStream";
import { useModelStore } from "@/lib/store/model";
import { useConversationStore } from "@/lib/store/conversation";
import { ConversationList } from "@/components/sidebar/ConversationList";
import { ModelSwitcher } from "@/components/model/ModelSwitcher";
import { ModelSettings } from "@/components/model/ModelSettings";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import { AskCard } from "./AskCard";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { parseAskCard } from "@/lib/utils/parseAskCard";
import { X, RefreshCw } from "lucide-react";

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
    updateUserMessage,
    removeLastAssistantMessage,
  } = useConversation();

  const activeModelId = useModelStore((s) => s.activeModelId);
  const settings = useModelStore((s) => s.modelSettings[activeModelId]);

  const { rawContent, isStreaming, isSlowResponse, error, send, abort } =
    useStream({
      providerId: activeModelId,
      modelOptions: settings,
    });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  const userToggled = useRef(false);

  // Initialise responsive state from actual window width after mount
  useEffect(() => {
    const wide = window.innerWidth >= 1024;
    setSidebarOpen(wide);
    setIsNarrow(!wide);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      // Lock if closing, unlock if opening (matches auto behavior on wide)
      userToggled.current = !next;
      return next;
    });
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

  const hasHydrated = useConversationStore((s) => s._hasHydrated);

  const [askDismissed, setAskDismissed] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    showRetry: boolean;
  } | null>(null);

  const lastUserMessageRef = useRef<string>("");
  const assistantMsgIdRef = useRef<string>("");
  const activeConvIdRef = useRef<string>("");

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

  // Sync streaming content directly into the placeholder message.
  // The placeholder in allMessages has the same key (msgId) that will
  // persist after streaming — no key switch, no iframe destroy/recreate.
  // useLayoutEffect runs synchronously before paint, guaranteeing the
  // store update and rawContent update land in the same frame.
  useLayoutEffect(() => {
    const msgId = assistantMsgIdRef.current;
    const cId = activeConvIdRef.current;
    if (!msgId || !cId || cId === "new") return;
    updateAssistantMessage(cId, msgId, rawContent);
  }, [rawContent, updateAssistantMessage]);

  const doSend = useCallback(
    (cId: string) => {
      activeConvIdRef.current = cId;
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
    [createAssistantMessage, send],
  );

  const handleSend = useCallback(
    (content: string) => {
      lastUserMessageRef.current = content;
      setToast(null);
      setAskDismissed(false);

      const cId = sendMessage(content);
      activeConvIdRef.current = cId;
      if (cId !== activeId) {
        router.replace(`/c/${cId}`);
      }

      doSend(cId);
    },
    [sendMessage, activeId, doSend, router],
  );

  const handleRetry = useCallback(() => {
    abort();
    setAskDismissed(false);
    const cId = activeId;
    if (cId) removeLastAssistantMessage(cId);
    if (cId) doSend(cId);
  }, [activeId, doSend, removeLastAssistantMessage, abort]);

  const handleEditSubmit = useCallback(
    (msgId: string, newText: string) => {
      abort();
      setAskDismissed(false);
      lastUserMessageRef.current = newText;
      const cId = activeId;
      if (cId) {
        updateUserMessage(cId, msgId, newText);
        removeLastAssistantMessage(cId);
        doSend(cId);
      }
    },
    [activeId, doSend, updateUserMessage, removeLastAssistantMessage, abort],
  );

  const dismissToast = useCallback(() => setToast(null), []);

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

  // Detect <ask_user> block in the last assistant message
  const askCardData =
    !askDismissed &&
    !isStreaming &&
    !hasError &&
    lastMsg?.role === "assistant"
      ? parseAskCard(lastMsg.content)
      : null;

  const showAskLoading =
    isStreaming &&
    lastMsg?.role === "assistant" &&
    /<ask_user>/i.test(lastMsg.content) &&
    !/<\/ask_user>/i.test(lastMsg.content);

  // Sync error / cancelled into toast
  useEffect(() => {
    if (hasError) {
      setToast({
        message: `Response failed — ${error}`,
        showRetry: true,
      });
    } else if (wasCancelled) {
      setToast({
        message: "Response cancelled.",
        showRetry: true,
      });
    }
  }, [hasError, wasCancelled, error]);

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

        {/* Toast — error / cancelled notification */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-sm text-body shadow-sm dark:border-hairline dark:bg-surface-dark-elevated dark:text-on-dark">
            <span>{toast.message}</span>
            {toast.showRetry && (
              <button
                onClick={() => { dismissToast(); handleRetry(); }}
                className="flex items-center gap-1 rounded px-2 py-1 text-primary transition-colors hover:bg-canvas-soft dark:hover:bg-surface-dark"
              >
                <RefreshCw size={14} strokeWidth={1.5} />
                <span className="text-xs">Retry</span>
              </button>
            )}
            <button
              onClick={dismissToast}
              className="flex items-center justify-center rounded p-0.5 text-muted-soft transition-colors hover:text-body"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-4 dark:border-hairline">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-soft opacity-50 transition-opacity hover:opacity-100"
              aria-label="Toggle sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
            <ModelSwitcher />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ModelSettings />
          </div>
        </div>

        {/* Messages */}
        <MessageList
          messages={allMessages}
          isStreaming={waitingForFirstChunk}
          streaming={isStreaming}
          isSlow={isSlowResponse}
          onSendPrompt={handleSendPrompt}
          onEditSubmit={handleEditSubmit}
          onRetry={handleRetry}
        />

        {/* Ask loading indicator — model is generating options */}
        {showAskLoading && (
          <div className="shrink-0 px-4 pb-2">
            <div className="mx-auto flex w-full max-w-[680px] items-center gap-2 rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-sm text-muted dark:border-hairline dark:bg-surface-dark-elevated dark:text-on-dark-soft">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
              </span>
              正在生成选项...
            </div>
          </div>
        )}

        {/* Ask card — model wants to collect user input */}
        {askCardData && (
          <div className="shrink-0 px-4 pb-2">
            <AskCard
              questions={askCardData.questions}
              onSelect={(text) => {
                const ctx = lastUserMessageRef.current;
                const prefix = ctx
                  ? `关于"${ctx.slice(0, 100)}"，我的选择如下：\n\n`
                  : "";
                handleSend(prefix + text);
              }}
              onDismiss={() => setAskDismissed(true)}
            />
          </div>
        )}

        {/* Input */}
        <InputBar
          onSend={handleSend}
          onStop={abort}
          isStreaming={isStreaming}
          disabled={!hasHydrated}
        />

        {/* Debug panel — only rendered when NEXT_PUBLIC_DEBUG=true */}
        {process.env.NEXT_PUBLIC_DEBUG === "true" && (
          <DebugPanel
            rawContent={rawContent}
            isStreaming={isStreaming}
            isSlowResponse={isSlowResponse}
          />
        )}
      </div>
    </div>
  );
}
