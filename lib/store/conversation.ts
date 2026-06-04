import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Conversation, Message } from "@/types/conversation";
import { createConversationStorage } from "./storage";
import { createServerStorage } from "./server-storage";

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES = 200;

// Block persist writes until rehydration completes in the current tab,
// preventing the initial empty state from overwriting data in other tabs.
let storageBlocked = true;

const nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;

  createConversation: (modelId: string) => string;
  deleteConversation: (id: string) => void;
  setActive: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string,
  ) => void;
  updateTitle: (id: string, title: string) => void;
  removeLastAssistantMessage: (conversationId: string) => void;
  getActive: () => Conversation | undefined;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
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

      updateMessage: (
        conversationId: string,
        messageId: string,
        content: string,
      ) => {
        set((s) => {
          const cIdx = s.conversations.findIndex(
            (c) => c.id === conversationId,
          );
          if (cIdx === -1) return s;
          const conv = s.conversations[cIdx];
          const mIdx = conv.messages.findIndex(
            (m) => m.id === messageId,
          );
          if (mIdx === -1) return s;
          const newMsgs = [...conv.messages];
          newMsgs[mIdx] = { ...newMsgs[mIdx], content };
          const newConvs = [...s.conversations];
          newConvs[cIdx] = {
            ...conv,
            messages: newMsgs,
            updatedAt: Date.now(),
          };
          return { conversations: newConvs };
        });
      },

      removeLastAssistantMessage: (conversationId: string) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const lastIdx = [...c.messages].reverse().findIndex((m) => m.role === "assistant");
            if (lastIdx === -1) return c;
            const targetIdx = c.messages.length - 1 - lastIdx;
            return {
              ...c,
              messages: c.messages.slice(0, targetIdx),
              updatedAt: Date.now(),
            };
          }),
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

      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: "twt-conversations",
      storage: createJSONStorage(() => {
        const inner =
          process.env.NEXT_PUBLIC_STORAGE_MODE === "server"
            ? createServerStorage()
            : createConversationStorage();
        return {
          getItem: (name: string) => inner.getItem(name),
          setItem: (name: string, value: string) =>
            storageBlocked ? undefined : inner.setItem(name, value),
          removeItem: (name: string) =>
            storageBlocked ? undefined : inner.removeItem(name),
        };
      }),
      partialize: (state) => ({
        conversations: state.conversations,
        activeId: state.activeId,
      }),
      onRehydrateStorage: (state) => () => {
        state.setHasHydrated(true);
        storageBlocked = false;
      },
    },
  ),
);
