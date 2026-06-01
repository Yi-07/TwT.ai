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

function AssistantAvatar() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      className="w-[28px] h-[28px] shrink-0 mt-[2px]"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="mb-clip">
          <circle cx="64" cy="64" r="64" />
        </clipPath>

        {/* Light bg: warm terracotta-ivory */}
        <linearGradient id="mb-bg-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DEBFA5" />
          <stop offset="100%" stopColor="#E8D8C8" />
        </linearGradient>

        {/* Dark bg: deep space blue */}
        <linearGradient id="mb-bg-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#141B32" />
          <stop offset="100%" stopColor="#1E2848" />
        </linearGradient>

        {/* Light eyes: deep clay shimmer */}
        <linearGradient id="mb-eye-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%">
            <animate attributeName="stop-color" values="#8B5E3C;#A07850;#8B5E3C" dur="2.4s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%">
            <animate attributeName="stop-color" values="#A07850;#8B5E3C;#A07850" dur="2.4s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>

        {/* Dark eyes: electric blue shimmer */}
        <linearGradient id="mb-eye-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%">
            <animate attributeName="stop-color" values="#60C5F8;#90DFFF;#60C5F8" dur="2.4s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%">
            <animate attributeName="stop-color" values="#90DFFF;#60C5F8;#90DFFF" dur="2.4s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>

        {/* Light mouth: warm taupe shimmer */}
        <linearGradient id="mb-mouth-light" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%">
            <animate attributeName="stop-color" values="#9E8A7A;#B8A595;#9E8A7A" dur="2.4s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%">
            <animate attributeName="stop-color" values="#B8A595;#9E8A7A;#B8A595" dur="2.4s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>

        {/* Dark mouth: cool mint shimmer */}
        <linearGradient id="mb-mouth-dark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%">
            <animate attributeName="stop-color" values="#6EE7D8;#A0F5E8;#6EE7D8" dur="2.4s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%">
            <animate attributeName="stop-color" values="#A0F5E8;#6EE7D8;#A0F5E8" dur="2.4s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>
      </defs>

      <style>{`
        .mb-float {
          animation: mb-face-float 2.4s ease-in-out infinite;
          transform-origin: 64px 64px;
        }
        @keyframes mb-face-float {
          0%, 100% { transform: translateY(0)    scale(1);    }
          50%       { transform: translateY(-3px) scale(1.03); }
        }
        .mb-eye {
          transform-box: fill-box;
          transform-origin: center;
          animation: mb-blink 3s ease-in-out infinite;
        }
        @keyframes mb-blink {
          0%, 38%, 62%, 100% { transform: scaleY(1);    }
          50%                 { transform: scaleY(0.07); }
        }
        .mb-brow {
          transform-box: fill-box;
          transform-origin: center;
          animation: mb-brow-lift 3s ease-in-out infinite;
        }
        @keyframes mb-brow-lift {
          0%, 38%, 62%, 100% { transform: translateY(0);   }
          50%                 { transform: translateY(-3px); }
        }
      `}</style>

      <g clipPath="url(#mb-clip)">
        {/* Bg — crossfade via opacity transition */}
        <rect width="128" height="128" fill="url(#mb-bg-light)" style={{ transition: 'opacity var(--theme-transition-duration) var(--theme-transition-easing)' }} className="dark:opacity-0" />
        <rect width="128" height="128" fill="url(#mb-bg-dark)" style={{ transition: 'opacity var(--theme-transition-duration) var(--theme-transition-easing)' }} className="opacity-0 dark:opacity-100" />

        {/* Highlight — crossfade */}
        <rect width="128" height="58" fill="white" style={{ transition: 'opacity var(--theme-transition-duration) var(--theme-transition-easing)' }} className="opacity-[0.20] dark:opacity-0" />
        <rect width="128" height="58" fill="white" style={{ transition: 'opacity var(--theme-transition-duration) var(--theme-transition-easing)' }} className="opacity-0 dark:opacity-[0.06]" />

        {/* Light face — fades out in dark */}
        <g className="mb-float dark:opacity-0" style={{ transition: 'opacity var(--theme-transition-duration) var(--theme-transition-easing)' }}>
          <rect className="mb-brow" x="24" y="22" width="30" height="6" rx="3" fill="url(#mb-eye-light)" />
          <rect className="mb-eye"  x="33" y="34" width="7"  height="24" rx="3.5" fill="url(#mb-eye-light)" />
          <rect className="mb-brow" x="74" y="22" width="30" height="6" rx="3" fill="url(#mb-eye-light)" />
          <rect className="mb-eye"  x="88" y="34" width="7"  height="24" rx="3.5" fill="url(#mb-eye-light)" />
          <path d="M36 84 Q45 98 64 88 Q83 98 92 84" fill="none" stroke="url(#mb-mouth-light)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 84 Q33 79 36 75" fill="none" stroke="url(#mb-mouth-light)" strokeWidth="7" strokeLinecap="round" />
          <path d="M92 84 Q95 79 92 75" fill="none" stroke="url(#mb-mouth-light)" strokeWidth="7" strokeLinecap="round" />
        </g>

        {/* Dark face — fades in in dark */}
        <g className="mb-float opacity-0 dark:opacity-100" style={{ transition: 'opacity var(--theme-transition-duration) var(--theme-transition-easing)' }}>
          <rect className="mb-brow" x="24" y="22" width="30" height="6" rx="3" fill="url(#mb-eye-dark)" />
          <rect className="mb-eye"  x="33" y="34" width="7"  height="24" rx="3.5" fill="url(#mb-eye-dark)" />
          <rect className="mb-brow" x="74" y="22" width="30" height="6" rx="3" fill="url(#mb-eye-dark)" />
          <rect className="mb-eye"  x="88" y="34" width="7"  height="24" rx="3.5" fill="url(#mb-eye-dark)" />
          <path d="M36 84 Q45 98 64 88 Q83 98 92 84" fill="none" stroke="url(#mb-mouth-dark)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 84 Q33 79 36 75" fill="none" stroke="url(#mb-mouth-dark)" strokeWidth="7" strokeLinecap="round" />
          <path d="M92 84 Q95 79 92 75" fill="none" stroke="url(#mb-mouth-dark)" strokeWidth="7" strokeLinecap="round" />
        </g>
      </g>

      {/* Rim light — dark only, with transition */}
      <circle
        cx="64" cy="64" r="63"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        style={{ transition: 'opacity var(--theme-transition-duration) var(--theme-transition-easing)' }} className="opacity-0 dark:opacity-[0.07]"
      />
    </svg>
  );
}

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
    <div className="my-3 rounded-lg border border-hairline bg-canvas-card px-3 py-2 sm:px-4 sm:py-3 dark:border-[#2E2C2A] dark:bg-[#1E1C1A]">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-xs sm:text-sm text-body dark:text-on-dark-soft">
          {status}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </span>
        <span className="text-[10px] sm:text-xs text-muted-soft">生成「{title}」</span>
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
          {seg.content}
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

  // Per-message parser instance — the parser is recreated on every
  // render so its internal delta tracking (this.processed) stays in
  // sync with the stripped content passed to it.
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
          <div data-message-id={message.id} className="rounded-2xl rounded-br-md bg-user-bubble px-5 py-3 text-ink dark:text-on-dark">
            {editing ? (
              <div className="flex flex-col gap-3">
                <textarea
                  className="w-full resize-none rounded-xl border border-hairline bg-canvas px-4 py-3 text-[15px] leading-relaxed text-ink outline-none focus:border-primary dark:border-hairline dark:bg-[#1E1D1B] dark:text-on-dark dark:focus:border-primary"
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
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={handleEditCancel}
                    className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-sm text-body transition-colors hover:bg-[#DDD8CE] dark:bg-[#2D2B27] dark:text-on-dark dark:hover:bg-[#3A3733]"
                  >
                    Cancel
                  </button>
                  <span className="text-[11px] text-muted-soft">Shift+Enter · newline</span>
                  <button
                    onClick={handleEditDone}
                    className="rounded-xl bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary-active"
                  >
                    Send
                  </button>
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
        <AssistantAvatar />

        {/* Content area */}
        <div data-message-id={message.id} className="min-w-0 flex-1">
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
