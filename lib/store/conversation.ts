import { create } from "zustand";
import type { Conversation, Message } from "@/types/conversation";

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

export const useConversationStore = create<ConversationState>()((set, get) => ({
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
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeId: id,
    }));
    return id;
  },

  deleteConversation: (id: string) => {
    set((s) => {
      const filtered = s.conversations.filter((c) => c.id !== id);
      return {
        conversations: filtered,
        activeId: s.activeId === id ? (filtered[0]?.id ?? null) : s.activeId,
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
              messages: [...c.messages, message],
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
}));
