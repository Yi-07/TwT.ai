import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Conversation, Message } from "@/types/conversation";
import { createConversationStorage } from "./storage";

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES = 200;

const nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;

  createConversation: (modelId: string) => string;
  deleteConversation: (id: string) => void;
  setActive: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateTitle: (id: string, title: string) => void;
  getActive: () => Conversation | undefined;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,

      createConversation: (modelId: string) => {
        const id = nextId();
        const now = Date.now();
        const conversation: Conversation = {
          id,
          title: "New conversation",
          messages: [],
          modelId,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => {
          const trimmed =
            s.conversations.length >= MAX_CONVERSATIONS
              ? s.conversations.slice(0, MAX_CONVERSATIONS - 1)
              : s.conversations;
          return {
            conversations: [conversation, ...trimmed],
            activeId: id,
          };
        });
        return id;
      },

      deleteConversation: (id: string) => {
        set((s) => {
          const filtered = s.conversations.filter((c) => c.id !== id);
          return {
            conversations: filtered,
            activeId:
              s.activeId === id ? (filtered[0]?.id ?? null) : s.activeId,
          };
        });
      },

      setActive: (id: string) => {
        set({ activeId: id });
      },

      addMessage: (conversationId: string, message: Message) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.concat(message).slice(-MAX_MESSAGES),
                  updatedAt: Date.now(),
                  title:
                    c.messages.length === 0 && message.role === "user"
                      ? message.content.slice(0, 50)
                      : c.title,
                }
              : c,
          ),
        }));
      },

      updateTitle: (id: string, title: string) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title } : c,
          ),
        }));
      },

      getActive: () => {
        const { conversations, activeId } = get();
        return conversations.find((c) => c.id === activeId);
      },
    }),
    {
      name: "twt-conversations",
      storage: createJSONStorage(() => createConversationStorage()),
      partialize: (state) => ({
        conversations: state.conversations,
        activeId: state.activeId,
      }),
    },
  ),
);
