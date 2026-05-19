"use client";

import type { Conversation } from "@/types/conversation";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
        isActive
          ? "bg-zinc-200/70 dark:bg-zinc-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
      <span className="shrink-0 text-[11px] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-60">
        {relativeTime(conversation.updatedAt)}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(conversation.id);
        }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-zinc-200 group-hover:opacity-100 dark:hover:bg-zinc-700"
        aria-label={`Delete ${conversation.title}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-400"
        >
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </button>
  );
}
