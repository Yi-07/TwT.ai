"use client";

export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="sr-only">AI is responding</span>
      <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
      <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}
