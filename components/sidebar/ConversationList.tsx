"use client";

import { useConversation } from "@/hooks/useConversation";
import { getDefaultModel } from "@/lib/providers/registry";
import { ConversationItem } from "./ConversationItem";

export function ConversationList() {
  const {
    conversations,
    activeId,
    createConversation,
    deleteConversation,
    updateTitle,
    setActive,
  } = useConversation();

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-3">
        <button
          onClick={() => createConversation(getDefaultModel())}
          className="flex w-full items-center gap-2 rounded-lg border border-hairline px-3 py-2.5 text-sm font-medium text-body hover:bg-canvas-card dark:border-hairline dark:text-on-dark dark:hover:bg-surface-dark-elevated"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-400">
            No conversations yet
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeId}
                onSelect={setActive}
                onDelete={deleteConversation}
                onRename={updateTitle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
