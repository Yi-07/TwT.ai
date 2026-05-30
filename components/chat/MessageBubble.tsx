"use client";

import { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Pencil, RefreshCw } from "lucide-react";
import type { Message } from "@/types/conversation";
import type { Segment } from "@/types/artifact";
import { ArtifactParser } from "@/lib/utils/parseArtifact";
import { ArtifactSandbox } from "@/components/artifact/ArtifactSandbox";
import { ArtifactToolbar } from "@/components/artifact/ArtifactToolbar";

// --- Independent module-level component (not defined inside MessageBubble) ---

function detectPhase(code: string, artifactType?: string): string {
  const len = code.length;
  if (len === 0) return "正在分析需求…";

  if (artifactType === "svg") {
    if (!code.includes("</svg>")) return "正在绘制图形…";
    return "即将完成…";
  }

  if (artifactType === "html") {
    if (!code.includes("<style") && !code.includes("<script") && len < 1200)
      return "正在构建页面结构…";
    if (code.includes("<style") && !code.includes("</style>"))
      return "正在编写样式…";
    if (code.includes("<script") && !code.includes("</script>"))
      return "正在编写脚本…";
    if (code.includes("</style>") && !code.includes("<script"))
      return "正在构建脚本…";
    if (code.includes("</script>"))
      return "即将完成…";
  }

  // react (default)
  if (artifactType !== "html" && artifactType !== "svg") {
    if (code.includes("import ") && !code.includes("export default"))
      return "正在导入依赖…";
    if (
      (code.includes("return (") || code.includes("return(")) &&
      code.length > 500
    )
      return "正在构建视图…";
    if (
      (code.includes("const ") && code.match(/const\s+\w+/g)?.length === 1) ||
      (code.includes("function ") && !code.includes("return"))
    )
      return "正在编写组件骨架…";
    if (code.includes("export default") && code.length < 800)
      return "正在编写组件逻辑…";
  }

  // Length-based fallback
  if (len < 1000) return "正在编写代码…";
  if (len < 4000) return "代码生成中…";
  if (len < 12000) return "即将完成…";
  return "正在收尾…";
}

function PlaceholderBar({
  title,
  preview,
  artifactType,
}: {
  title: string;
  preview?: string;
  artifactType?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasPreview = preview && preview.trim().length > 0;
  const status = detectPhase(preview ?? "", artifactType);

  return (
    <div className="my-3 rounded-lg border border-hairline bg-canvas-card px-4 py-3 dark:border-[#2E2C2A] dark:bg-[#1E1C1A]">
      <div className="flex items-center gap-2">
        <span className="text-sm text-body dark:text-on-dark-soft">
          {status}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </span>
        <span className="text-xs text-muted-soft">生成「{title}」</span>
        {hasPreview && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-xs text-muted underline underline-offset-2 hover:text-body"
          >
            {expanded ? "收起代码" : "点击查看"}
          </button>
        )}
      </div>
      {hasPreview && expanded && (
        <pre className="mt-3 max-h-60 overflow-y-auto rounded-lg bg-code-block p-3 text-xs text-ink dark:text-on-dark-soft">
          <code>{preview}</code>
        </pre>
      )}
    </div>
  );
}

interface SegmentRendererProps {
  seg: Segment;
  onSendPrompt?: (text: string) => void;
}

function SegmentRenderer({ seg, onSendPrompt }: SegmentRendererProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [hovered, setHovered] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (seg.type === "text") {
    return (
      <div className="prose prose-zinc prose-base dark:prose-invert max-w-none [&_pre]:rounded-xl [&_pre]:bg-code-block [&_pre]:text-ink dark:[&_pre]:text-on-dark-soft [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-sm [&_code]:rounded-md [&_code]:bg-code-block [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_table]:w-full [&_th]:border [&_th]:border-hairline [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-hairline [&_td]:px-3 [&_td]:py-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {seg.content.replace(/~/g, "\\~")}
        </ReactMarkdown>
      </div>
    );
  }

  if (seg.type === "placeholder") {
    return (
      <PlaceholderBar
        title={seg.title}
        preview={seg.preview}
        artifactType={seg.artifactType}
      />
    );
  }

  return (
    <div
      className="mt-4 border-t border-hairline pt-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ArtifactToolbar
        title={seg.title}
        visible={hovered}
        content={seg.content}
        artifactType={seg.artifactType}
        onRefresh={handleRefresh}
      />
      <ArtifactSandbox
        key={refreshKey}
        artifactType={seg.artifactType}
        title={seg.title}
        content={seg.content}
        onSendPrompt={onSendPrompt}
      />
    </div>
  );
}

// --- MessageBubble ---

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  isSlow?: boolean;
  onSendPrompt?: (text: string) => void;
  isLastUserMsg?: boolean;
  onEditSubmit?: (msgId: string, newText: string) => void;
  onRetry?: () => void;
}

export function MessageBubble({
  message,
  streaming,
  isSlow,
  onSendPrompt,
  isLastUserMsg,
  onEditSubmit,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const handleEditStart = () => {
    setEditText(message.content);
    setEditing(true);
  };

  const handleEditDone = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      onEditSubmit?.(message.id, trimmed);
    }
    setEditing(false);
  };

  const handleEditCancel = () => {
    setEditing(false);
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [message.content]);

  // Per-message parser instance — eliminates module-level singleton
  // interference when multiple messages render simultaneously.
  // Strip <ask_user> blocks — both completed and in-progress (streaming)
  const segments = useMemo(() => {
    const content = message.content
      .replace(/<ask_user>[\s\S]*?<\/ask_user>/g, "")
      .replace(/<ask_user>[\s\S]*$/, "");
    const parser = new ArtifactParser();
    parser.parse(content);
    return parser.flush(!streaming);
  }, [message.content, streaming]);

  if (isUser) {
    return (
      <div className="flex w-full animate-fade-in justify-end">
        <div className="group flex max-w-[80%] flex-col items-end">
          <div className="rounded-2xl rounded-br-md bg-user-bubble px-5 py-3 text-ink dark:text-on-dark">
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full resize-none rounded-lg bg-canvas px-3 py-2 text-[15px] leading-relaxed text-ink outline-none dark:bg-surface-dark-elevated dark:text-on-dark"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleEditDone();
                    }
                    if (e.key === "Escape") handleEditCancel();
                  }}
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center gap-2 text-xs text-muted-soft">
                  <span>Enter · send</span>
                  <span>Shift+Enter · newline</span>
                  <span>Esc · cancel</span>
                </div>
              </div>
            ) : (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            )}
          </div>
          {/* Hover icons — Copy / Edit / Retry */}
          {!editing && (
            <div className="mt-1 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button onClick={handleCopy} className="flex h-6 w-6 items-center justify-center rounded text-body/60 transition-colors hover:text-body hover:bg-canvas-soft" aria-label="Copy">
                {copied ? (
                  <span className="text-[10px] font-medium">✓</span>
                ) : (
                  <Copy size={13} strokeWidth={1.5} />
                )}
              </button>
              {onEditSubmit && (
                <button onClick={handleEditStart} className="flex h-6 w-6 items-center justify-center rounded text-body/60 transition-colors hover:text-body hover:bg-canvas-soft" aria-label="Edit">
                  <Pencil size={13} strokeWidth={1.5} />
                </button>
              )}
              {isLastUserMsg && onRetry && (
                <button onClick={onRetry} className="flex h-6 w-6 items-center justify-center rounded text-body/60 transition-colors hover:text-body hover:bg-canvas-soft" aria-label="Retry">
                  <RefreshCw size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full animate-fade-in justify-start">
      <div className="flex w-full max-w-3xl items-start gap-3 px-4 py-2">
        {/* Avatar — robot face, permanent for every assistant message */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 128 128"
          className="shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="av-eye" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%">
                <animate attributeName="stop-color" values="#A09BE8;#D4C8FF;#A09BE8" dur="2.2s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%">
                <animate attributeName="stop-color" values="#D4C8FF;#A09BE8;#D4C8FF" dur="2.2s" repeatCount="indefinite"/>
              </stop>
            </linearGradient>
            <linearGradient id="av-mouth" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%">
                <animate attributeName="stop-color" values="#67E8C9;#B8F5E8;#67E8C9" dur="2.2s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%">
                <animate attributeName="stop-color" values="#B8F5E8;#67E8C9;#B8F5E8" dur="2.2s" repeatCount="indefinite"/>
              </stop>
            </linearGradient>
          </defs>
          <style>{`
            .av-eye { transform-box: fill-box; transform-origin: center; animation: av-blink 3s ease-in-out infinite; }
            @keyframes av-blink { 0%,38%,62%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.07); } }
            .av-brow { transform-box: fill-box; transform-origin: center; animation: av-brow-lift 3s ease-in-out infinite; }
            @keyframes av-brow-lift { 0%,38%,62%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
          `}</style>
          <rect width="128" height="128" rx="28" fill="#1a1f2e" />
          <rect x="0" y="0" width="128" height="56" rx="28" fill="white" opacity="0.05" />
          <rect className="av-brow" x="24" y="22" width="30" height="6" rx="3" fill="url(#av-eye)" />
          <rect className="av-eye" x="33" y="34" width="7" height="24" rx="3.5" fill="url(#av-eye)" />
          <rect className="av-brow" x="74" y="22" width="30" height="6" rx="3" fill="url(#av-eye)" />
          <rect className="av-eye" x="88" y="34" width="7" height="24" rx="3.5" fill="url(#av-eye)" />
          <path d="M36 84 Q45 98 64 88 Q83 98 92 84" fill="none" stroke="url(#av-mouth)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 84 Q33 79 36 75" fill="none" stroke="url(#av-mouth)" strokeWidth="6.5" strokeLinecap="round" />
          <path d="M92 84 Q95 79 92 75" fill="none" stroke="url(#av-mouth)" strokeWidth="6.5" strokeLinecap="round" />
        </svg>

        {/* Content area */}
        <div className="min-w-0 flex-1">
          <div className="group">
            {message.content === "" && streaming ? (
              <span className="text-sm text-body dark:text-on-dark-soft">
                {isSlow
                  ? "模型响应较慢，请耐心等待...或点击取消后重试"
                  : "TωT 思考中..."}
              </span>
            ) : (
              <div className="flex flex-col gap-2">
                {segments.map((seg) => (
                  <SegmentRenderer
                    key={seg.id}
                    seg={seg}
                    onSendPrompt={onSendPrompt}
                  />
                ))}
              </div>
            )}
            {/* Hover Copy for assistant messages — only after streaming completes */}
            {!streaming && (
              <div className="mt-1.5 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={handleCopy}
                  className="flex h-6 w-6 items-center justify-center rounded text-body/60 transition-colors hover:text-body hover:bg-canvas-soft"
                  aria-label="Copy"
                >
                  {copied ? (
                    <span className="text-[10px] font-medium">✓</span>
                  ) : (
                    <Copy size={13} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
