"use client";

import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import type { Conversation } from "@/types/conversation";
import { EllipsisVertical, Trash2, Pencil } from "lucide-react";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
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

type Action = "delete" | "rename" | null;

function ConversationItemInner({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [confirmAction, setConfirmAction] = useState<Action>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setMenuOpen(false);
    setConfirmAction(null);
    setRenameOpen(false);
  };

  useEffect(() => {
    if (!menuOpen && !confirmAction) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmAction(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [menuOpen, confirmAction]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(conversation.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(conversation.id);
          }
        }}
        className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
          isActive
            ? "bg-[#F0ECE2] dark:bg-[#2A2722]"
            : "hover:bg-canvas-soft dark:hover:bg-surface-dark"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-body dark:text-on-dark">
          {conversation.title}
        </span>

        {!menuOpen && !confirmAction && (
          <span className="hidden shrink-0 text-[11px] text-muted-soft opacity-0 transition-opacity sm:block group-hover:opacity-100">
            {relativeTime(conversation.updatedAt)}
          </span>
        )}

        <div className="relative shrink-0" ref={menuRef}>
          {!confirmAction && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const menuH = 90;
                const top =
                  rect.bottom + menuH > window.innerHeight
                    ? rect.top - menuH
                    : rect.bottom;
                setMenuPos({ top, left: rect.right - 120 });
                setMenuOpen((v) => !v);
              }}
              className={`flex h-6 w-6 items-center justify-center rounded text-muted-soft transition-opacity hover:text-body dark:hover:text-on-dark ${
                isActive ? "" : "opacity-0 group-hover:opacity-100"
              }`}
              aria-label="More actions"
            >
              <EllipsisVertical size={14} />
            </button>
          )}

          {menuOpen &&
            menuPos &&
            !confirmAction &&
            createPortal(
              <div
                className="fixed z-50 min-w-[120px] rounded-lg border border-hairline bg-canvas py-1 shadow-lg dark:border-hairline dark:bg-surface-dark-elevated"
                style={{ top: menuPos.top, left: menuPos.left }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setRenameValue(conversation.title);
                    setRenameOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-body transition-colors hover:bg-canvas-soft dark:text-on-dark dark:hover:bg-surface-dark"
                >
                  <Pencil size={13} className="text-muted-soft" />
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setConfirmAction("delete");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-body transition-colors hover:bg-canvas-soft dark:text-on-dark dark:hover:bg-surface-dark"
                >
                  <Trash2 size={13} className="text-muted-soft" />
                  Delete
                </button>
              </div>,
              document.body,
            )}

          {confirmAction && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 backdrop-blur-sm"
              onClick={() => setConfirmAction(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="mx-4 w-full max-w-xs rounded-2xl border border-hairline bg-canvas px-6 py-5 shadow-xl dark:border-hairline dark:bg-surface-dark-elevated"
              >
                <p className="mb-4 text-base font-medium text-ink dark:text-on-dark">
                  {confirmAction === "delete"
                    ? "Delete this conversation?"
                    : "Rename this conversation?"}
                </p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmAction(null);
                    }}
                    className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-sm text-body transition-colors hover:bg-[#DDD8CE] dark:bg-[#2D2B27] dark:text-on-dark dark:hover:bg-[#3A3733]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmAction === "delete") {
                        onDelete(conversation.id);
                        closeAll();
                      } else {
                        setConfirmAction(null);
                        onRename(conversation.id, renameValue);
                        closeAll();
                      }
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${
                      confirmAction === "delete"
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-primary hover:bg-primary-active"
                    }`}
                  >
                    {confirmAction === "delete" ? "Delete" : "Rename"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {renameOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          onClick={closeAll}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-sm rounded-2xl border border-hairline bg-canvas p-6 shadow-xl dark:border-hairline dark:bg-surface-dark-elevated"
          >
            <h3 className="mb-4 text-base font-medium text-ink dark:text-on-dark">
              Rename conversation
            </h3>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = renameValue.trim();
                  if (trimmed) {
                    setRenameOpen(false);
                    setConfirmAction("rename");
                  }
                }
                if (e.key === "Escape") closeAll();
              }}
              className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary dark:border-hairline dark:bg-[#1E1D1B] dark:text-on-dark dark:focus:border-primary"
              autoFocus
            />
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={closeAll}
                className="rounded-xl bg-[#E8E4DC] px-4 py-2 text-sm text-body transition-colors hover:bg-[#DDD8CE] dark:bg-[#2D2B27] dark:text-on-dark dark:hover:bg-[#3A3733]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const trimmed = renameValue.trim();
                  if (!trimmed) return;
                  setRenameOpen(false);
                  setConfirmAction("rename");
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary-active"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const ConversationItem = memo(ConversationItemInner, (prev, next) => {
  return (
    prev.conversation.id === next.conversation.id &&
    prev.conversation.title === next.conversation.title &&
    prev.conversation.updatedAt === next.conversation.updatedAt &&
    prev.isActive === next.isActive &&
    prev.onSelect === next.onSelect &&
    prev.onDelete === next.onDelete &&
    prev.onRename === next.onRename
  );
});
