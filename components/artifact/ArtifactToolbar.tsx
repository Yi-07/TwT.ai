"use client";

import { useState, useCallback } from "react";
import type { ArtifactType } from "@/types/artifact";

interface ArtifactToolbarProps {
  title: string;
  expanded: boolean;
  content: string;
  artifactType: ArtifactType;
  onRefresh: () => void;
  onToggleExpand: () => void;
}

const EXT_MAP: Record<ArtifactType, string> = {
  react: "component.tsx",
  html: "index.html",
  svg: "image.svg",
};

const MIME_MAP: Record<ArtifactType, string> = {
  react: "text/plain",
  html: "text/html",
  svg: "image/svg+xml",
};

function downloadFile(content: string, type: ArtifactType) {
  const filename = EXT_MAP[type];
  const mime = MIME_MAP[type];
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const btnClass =
  "flex h-6 w-6 items-center justify-center rounded text-muted-soft opacity-40 transition-opacity hover:opacity-100 hover:text-muted dark:hover:text-on-dark-soft";

export function ArtifactToolbar({
  title,
  expanded,
  content,
  artifactType,
  onRefresh,
  onToggleExpand,
}: ArtifactToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard denied — silently ignore
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    downloadFile(content, artifactType);
  }, [content, artifactType]);

  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <span className="min-w-0 flex-1 truncate text-xs text-muted dark:text-on-dark-soft">
        {title}
      </span>

      <button onClick={handleCopy} className={btnClass} aria-label="Copy source">
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-teal">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>

      <button onClick={handleDownload} className={btnClass} aria-label="Download source">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      <button onClick={onRefresh} className={btnClass} aria-label="Refresh artifact">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </button>

      <button onClick={onToggleExpand} className={btnClass} aria-label={expanded ? "Collapse artifact" : "Expand artifact"}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={expanded ? "rotate-180" : ""}>
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
    </div>
  );
}
