"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types/conversation";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-zinc-900 px-5 py-3 text-zinc-50"
            : "w-full max-w-3xl px-4 py-2"
        }
      >
        {isUser ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <div className="prose prose-zinc prose-base dark:prose-invert max-w-none [&_pre]:rounded-xl [&_pre]:bg-zinc-950 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-sm [&_code]:rounded-md [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm dark:[&_code]:bg-zinc-800 [&_table]:w-full [&_th]:border [&_th]:border-zinc-200 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-zinc-200 [&_td]:px-3 [&_td]:py-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
