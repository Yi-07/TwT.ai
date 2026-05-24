"use client";

import { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types/conversation";
import type { Segment } from "@/types/artifact";
import { ArtifactParser } from "@/lib/utils/parseArtifact";
import { ArtifactSandbox } from "@/components/artifact/ArtifactSandbox";
import { ArtifactToolbar } from "@/components/artifact/ArtifactToolbar";

// --- Independent module-level component (not defined inside MessageBubble) ---

interface SegmentRendererProps {
  seg: Segment;
  onSendPrompt?: (text: string) => void;
}

function SegmentRenderer({ seg, onSendPrompt }: SegmentRendererProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (seg.type === "text") {
    return (
      <div className="prose prose-zinc prose-base dark:prose-invert max-w-none [&_pre]:rounded-xl [&_pre]:bg-code-block [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-sm [&_code]:rounded-md [&_code]:bg-code-block [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_table]:w-full [&_th]:border [&_th]:border-hairline [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-hairline [&_td]:px-3 [&_td]:py-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {seg.content}
        </ReactMarkdown>
      </div>
    );
  }

  if (seg.type === "placeholder") {
    const hasPreview = seg.preview && seg.preview.trim().length > 0;
    return (
      <div className="my-3 rounded-lg border border-hairline bg-canvas-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">
            正在生成「{seg.title}」
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </span>
          {hasPreview && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto text-xs text-muted-soft underline underline-offset-2 hover:text-muted"
            >
              {expanded ? "收起代码" : "点击查看"}
            </button>
          )}
        </div>
        {hasPreview && expanded && (
          <pre className="mt-3 max-h-60 overflow-y-auto rounded-lg bg-surface-dark p-3 text-xs text-on-dark-soft">
            <code>{seg.preview}</code>
          </pre>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-4 border-l-2 border-hairline pl-3 dark:border-hairline"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ArtifactToolbar
        title={seg.title}
        expanded={expanded}
        visible={hovered}
        content={seg.content}
        artifactType={seg.artifactType}
        onRefresh={handleRefresh}
        onToggleExpand={handleToggleExpand}
      />
      <ArtifactSandbox
        key={refreshKey}
        artifactType={seg.artifactType}
        title={seg.title}
        content={seg.content}
        expanded={expanded}
        onSendPrompt={onSendPrompt}
      />
    </div>
  );
}

// --- MessageBubble ---

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  onSendPrompt?: (text: string) => void;
}

export function MessageBubble({ message, streaming, onSendPrompt }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Per-message parser instance — eliminates module-level singleton
  // interference when multiple messages render simultaneously.
  const segments = useMemo(() => {
    const parser = new ArtifactParser();
    parser.parse(message.content);
    return parser.flush(!streaming);
  }, [message.content, streaming]);

  return (
    <div
      className={`flex w-full animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-user-bubble px-5 py-3 text-ink"
            : "w-full max-w-3xl px-4 py-2"
        }
      >
        {isUser ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {segments.map((seg) => (
              <SegmentRenderer key={seg.id} seg={seg} onSendPrompt={onSendPrompt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
