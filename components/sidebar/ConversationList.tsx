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
    setActive,
  } = useConversation();

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-3">
        <button
          onClick={() => createConversation(getDefaultModel())}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
