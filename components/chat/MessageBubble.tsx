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

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (seg.type === "text") {
    return (
      <div className="prose prose-zinc prose-base dark:prose-invert max-w-none [&_pre]:rounded-xl [&_pre]:bg-zinc-950 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-sm [&_code]:rounded-md [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm dark:[&_code]:bg-zinc-800 [&_table]:w-full [&_th]:border [&_th]:border-zinc-200 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-zinc-200 [&_td]:px-3 [&_td]:py-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {seg.content}
        </ReactMarkdown>
      </div>
    );
  }

  if (seg.type === "placeholder") {
    return (
      <div className="my-3 flex items-center gap-2 rounded-lg border border-hairline bg-canvas-card px-4 py-3 dark:border-hairline dark:bg-surface-dark-elevated">
        <span className="text-sm text-muted dark:text-on-dark-soft">
          正在生成「{seg.title}」
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 border-l-2 border-hairline pl-3 dark:border-hairline">
      <ArtifactToolbar
        title={seg.title}
        expanded={expanded}
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
  onSendPrompt?: (text: string) => void;
}

export function MessageBubble({ message, onSendPrompt }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Per-message parser instance — eliminates module-level singleton
  // interference when multiple messages render simultaneously.
  const segments = useMemo(() => {
    const parser = new ArtifactParser();
    return parser.parse(message.content);
  }, [message.content]);

  return (
    <div
      className={`flex w-full animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary px-5 py-3 text-white"
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
