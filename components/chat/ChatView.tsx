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
import { InputBar, type InputBarHandle } from "./InputBar";
import { SelectionReply } from "./SelectionReply";
import { AskCard } from "./AskCard";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { parseAskCard } from "@/lib/utils/parseAskCard";
import { waitForPersistence } from "@/lib/store/server-storage";
import { generateTitle } from "@/lib/utils/generateTitle";
import { X, RefreshCw } from "lucide-react";

interface ChatViewProps {
  conversationId: string;
  availableProviders: { id: string; name: string; model: string }[];
}

export function ChatView({ conversationId, availableProviders }: ChatViewProps) {
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

  const inputBarRef = useRef<InputBarHandle>(null);

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

  // Auto-generate conversation title after the first exchange completes
  const prevStreamingRef = useRef(isStreaming);
  const updateTitle = useConversationStore((s) => s.updateTitle);
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;
    if (!wasStreaming || isStreaming) return;
    const { conversations } = useConversationStore.getState();
    const conv = conversations.find((c) => c.id === activeId);
    if (
      conv &&
      conv.title === "New conversation" &&
      conv.messages.length >= 2
    ) {
      const firstUserMsg =
        conv.messages.find((m) => m.role === "user")?.content ?? "";
      if (firstUserMsg) {
        generateTitle(activeModelId, firstUserMsg).then((title) => {
          if (title && title !== "New conversation" && activeId) {
            updateTitle(activeId, title);
          } else if (activeId) {
            updateTitle(activeId, firstUserMsg.slice(0, 30));
          }
        });
      }
    }
  }, [isStreaming, activeId, activeModelId, updateTitle]);

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

      send(messages, cId);
    },
    [createAssistantMessage, send],
  );

  const handleSend = useCallback(
    async (content: string) => {
      // Guard all send paths (InputBar + sandbox sendPrompt) against
      // duplicate sends while a stream is already in progress.
      if (isStreaming) return;

      lastUserMessageRef.current = content;
      setToast(null);
      setAskDismissed(false);

      const cId = sendMessage(content);
      activeConvIdRef.current = cId;
      if (cId !== activeId) {
        // When using server storage, wait for the conversation to be
        // persisted before redirecting — otherwise a fast hard-refresh
        // on the new page may issue GET /api/conversations before the
        // POST has landed (Neon cold-start + network latency).
        await waitForPersistence();
        router.replace(`/c/${cId}`);
      }

      doSend(cId);
      // Scroll to the new message after the DOM has updated
      setTimeout(() => {
        const el = document.querySelector('[data-scroll-container]');
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
    },
    [sendMessage, activeId, doSend, router, isStreaming],
  );

  const handleRetry = useCallback(() => {
    abort();
    setToast(null);
    setAskDismissed(false);
    const cId = activeId;
    if (cId) removeLastAssistantMessage(cId);
    if (cId) doSend(cId);
    // Scroll to the new message after the DOM has updated
    setTimeout(() => {
      const el = document.querySelector('[data-scroll-container]');
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
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
        // Scroll to the new message after the DOM has updated
        setTimeout(() => {
          const el = document.querySelector('[data-scroll-container]');
          if (el) el.scrollTop = el.scrollHeight;
        }, 0);
      }
    },
    [activeId, doSend, updateUserMessage, removeLastAssistantMessage, abort],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const handleSendPrompt = useCallback(
    (text: string) => {
      handleSend(text);
      // Scroll to the new message after the DOM has updated
      setTimeout(() => {
        const el = document.querySelector('[data-scroll-container]');
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
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

  return (
    <div className="flex h-screen overflow-hidden bg-canvas dark:bg-surface-dark">
      {/* Narrow overlay backdrop */}
      {isNarrow && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — inline on wide, overlay on narrow.
           Inline style for transition so width/transform and colour
           properties can use different durations without overriding
           each other. */}
      <aside
        style={{
          transition: isNarrow
            ? "transform 200ms, background-color var(--theme-transition-duration) var(--theme-transition-easing), color var(--theme-transition-duration) var(--theme-transition-easing), border-color var(--theme-transition-duration) var(--theme-transition-easing)"
            : "width 300ms ease-in-out, background-color var(--theme-transition-duration) var(--theme-transition-easing), color var(--theme-transition-duration) var(--theme-transition-easing), border-color var(--theme-transition-duration) var(--theme-transition-easing)",
        }}
        className={`border-r border-hairline bg-canvas-soft dark:border-hairline dark:bg-surface-dark-elevated ${
          isNarrow
            ? `fixed left-0 top-0 z-50 h-full w-64 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : `shrink-0 overflow-hidden ${
                sidebarOpen ? "w-64 border-r" : "w-0 border-r-0"
              }`
        }`}
      >
        <div className="flex h-12 items-center gap-2 border-b border-hairline px-4 dark:border-hairline" style={{ minWidth: 256 }}>
          <svg width="28" height="28" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
            <defs>
              <radialGradient id="sb-bg" cx="38%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#253555" />
                <stop offset="100%" stopColor="#1a2540" />
              </radialGradient>
              <linearGradient id="sb-eye" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"><animate attributeName="stop-color" values="#A09BE8;#D4C8FF;#A09BE8" dur="2.2s" repeatCount="indefinite"/></stop>
                <stop offset="100%"><animate attributeName="stop-color" values="#D4C8FF;#A09BE8;#D4C8FF" dur="2.2s" repeatCount="indefinite"/></stop>
              </linearGradient>
              <linearGradient id="sb-mouth" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"><animate attributeName="stop-color" values="#67E8C9;#B8F5E8;#67E8C9" dur="2.2s" repeatCount="indefinite"/></stop>
                <stop offset="100%"><animate attributeName="stop-color" values="#B8F5E8;#67E8C9;#B8F5E8" dur="2.2s" repeatCount="indefinite"/></stop>
              </linearGradient>
            </defs>
            <style>{`
              .sb-float { animation: sb-float 2.4s ease-in-out infinite; transform-origin: 64px 64px; }
              @keyframes sb-float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.04); } }
              .sb-eye { transform-box: fill-box; transform-origin: center; animation: sb-blink 3s ease-in-out infinite; }
              @keyframes sb-blink { 0%,38%,62%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.07); } }
              .sb-brow { transform-box: fill-box; transform-origin: center; animation: sb-brow-lift 3s ease-in-out infinite; }
              @keyframes sb-brow-lift { 0%,38%,62%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
            `}</style>
            <rect width="128" height="128" rx="28" fill="url(#sb-bg)" />
            <rect x="0" y="0" width="128" height="56" rx="28" fill="white" opacity="0.05" />
            <g className="sb-float">
              <rect className="sb-brow" x="24" y="22" width="30" height="6" rx="3" fill="url(#sb-eye)" />
              <rect className="sb-eye" x="33" y="34" width="7" height="24" rx="3.5" fill="url(#sb-eye)" />
              <rect className="sb-brow" x="74" y="22" width="30" height="6" rx="3" fill="url(#sb-eye)" />
              <rect className="sb-eye" x="88" y="34" width="7" height="24" rx="3.5" fill="url(#sb-eye)" />
              <path d="M36 84 Q45 98 64 88 Q83 98 92 84" fill="none" stroke="url(#sb-mouth)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M36 84 Q33 79 36 75" fill="none" stroke="url(#sb-mouth)" strokeWidth="6.5" strokeLinecap="round" />
              <path d="M92 84 Q95 79 92 75" fill="none" stroke="url(#sb-mouth)" strokeWidth="6.5" strokeLinecap="round" />
            </g>
          </svg>
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
            <ModelSwitcher providers={availableProviders} />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ModelSettings />
          </div>
        </div>

        {/* Messages */}
        <MessageList
          messages={allMessages}
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
          ref={inputBarRef}
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

        {/* Selection reply — floating button near text selection */}
        <SelectionReply inputRef={inputBarRef} />
      </div>
    </div>
  );
}
