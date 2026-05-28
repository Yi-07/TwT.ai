"use client";

import { useState } from "react";
import { useConversationStore } from "@/lib/store/conversation";

interface DebugPanelProps {
  rawContent: string;
  isStreaming: boolean;
  isSlowResponse: boolean;
}

export function DebugPanel({
  rawContent,
  isStreaming,
  isSlowResponse,
}: DebugPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastMsgInfo = useConversationStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    const last = conv?.messages.at(-1);
    return last
      ? { role: last.role, contentLen: last.content.length }
      : null;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(rawContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (collapsed) {
    return (
      <div className="shrink-0 border-t border-hairline bg-canvas-soft px-4 py-1 dark:border-hairline dark:bg-surface-dark">
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs text-muted hover:text-body font-mono"
        >
          [Debug] Open
        </button>
      </div>
    );
  }

  const preview = rawContent.slice(-500);

  return (
    <div className="shrink-0 border-t border-hairline bg-canvas-soft px-4 py-2 text-xs font-mono dark:border-hairline dark:bg-surface-dark">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-2">

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-muted">
            [Debug] {isStreaming ? "● streaming" : "○ idle"}
            {isSlowResponse && " ⚠ slow"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-muted hover:text-body transition-colors"
            >
              {copied ? "copied" : "copy raw"}
            </button>
            <button
              onClick={() => setCollapsed(true)}
              className="text-muted hover:text-body transition-colors"
            >
              close
            </button>
          </div>
        </div>

        {/* Raw content preview */}
        <div className="max-h-32 overflow-auto rounded border border-hairline bg-canvas p-2 dark:border-hairline dark:bg-surface-dark-elevated">
          <div className="text-muted mb-1">
            rawContent ({rawContent.length} chars):
          </div>
          <pre className="whitespace-pre-wrap break-all text-body dark:text-on-dark">
            {preview || "(empty)"}
          </pre>
        </div>

        {/* Message info */}
        <div className="flex gap-4 text-muted">
          <span>role: {lastMsgInfo?.role ?? "none"}</span>
          <span>content: {lastMsgInfo?.contentLen ?? 0} chars</span>
          <span>streaming: {String(isStreaming)}</span>
        </div>
      </div>
    </div>
  );
}
