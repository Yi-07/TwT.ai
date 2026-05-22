"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import type { ArtifactType } from "@/types/artifact";

interface ArtifactToolbarProps {
  title: string;
  expanded: boolean;
  visible: boolean;
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
  "flex h-6 w-6 items-center justify-center rounded transition-colors";

export function ArtifactToolbar({
  title,
  expanded,
  visible,
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
      // clipboard denied
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    downloadFile(content, artifactType);
  }, [content, artifactType]);

  return (
    <div
      className={`flex items-center gap-1 px-1 py-1 opacity-0 transition-opacity duration-150 ${
        visible ? "opacity-100" : ""
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-xs text-muted dark:text-on-dark-soft">
        {title}
      </span>

      <button onClick={handleCopy} className={btnClass} aria-label="Copy source">
        {copied ? (
          <Check size={14} className="text-accent-teal" />
        ) : (
          <Copy size={14} className="text-muted-soft dark:text-on-dark-soft" />
        )}
      </button>

      <button onClick={handleDownload} className={btnClass} aria-label="Download source">
        <Download size={14} className="text-muted-soft dark:text-on-dark-soft" />
      </button>

      <button onClick={onRefresh} className={btnClass} aria-label="Refresh artifact">
        <RefreshCw size={14} className="text-muted-soft dark:text-on-dark-soft" />
      </button>

      <button
        onClick={onToggleExpand}
        className={btnClass}
        aria-label={expanded ? "Collapse artifact" : "Expand artifact"}
      >
        <ChevronDown
          size={14}
          className={`text-muted-soft transition-transform dark:text-on-dark-soft ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}
