"use client";

import { useCallback } from "react";
import { useConversationStore } from "@/lib/store/conversation";
import { getDefaultModel } from "@/lib/providers/registry";
import type { Message } from "@/types/conversation";

const nextMsgId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function useConversation() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeId = useConversationStore((s) => s.activeId);
  const active = useConversationStore((s) =>
    s.conversations.find((c) => c.id === s.activeId),
  );

  const createConversation = useConversationStore((s) => s.createConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const setActive = useConversationStore((s) => s.setActive);
  const addMessage = useConversationStore((s) => s.addMessage);
  const updateMessage = useConversationStore((s) => s.updateMessage);

  const sendMessage = useCallback(
    (content: string) => {
      const cId = activeId ?? createConversation(getDefaultModel());
      const userMsg: Message = {
        id: nextMsgId(),
        role: "user",
        content,
        createdAt: Date.now(),
      };
      addMessage(cId, userMsg);
      return cId;
    },
    [activeId, createConversation, addMessage],
  );

  const createAssistantMessage = useCallback(
    (conversationId: string, msgId: string) => {
      const msg: Message = {
        id: msgId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };
      addMessage(conversationId, msg);
    },
    [addMessage],
  );

  const updateAssistantMessage = useCallback(
    (conversationId: string, msgId: string, content: string) => {
      updateMessage(conversationId, msgId, content);
    },
    [updateMessage],
  );

  const appendAssistantMessage = useCallback(
    (conversationId: string, content: string) => {
      const msg: Message = {
        id: nextMsgId(),
        role: "assistant",
        content,
        createdAt: Date.now(),
      };
      addMessage(conversationId, msg);
    },
    [addMessage],
  );

  return {
    conversations,
    activeId,
    active,
    createConversation,
    deleteConversation,
    setActive,
    sendMessage,
    createAssistantMessage,
    updateAssistantMessage,
    appendAssistantMessage,
  };
}
