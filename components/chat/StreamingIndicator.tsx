"use client";

interface StreamingIndicatorProps {
  isSlow: boolean;
}

export function StreamingIndicator({ isSlow }: StreamingIndicatorProps) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="sr-only">AI is responding</span>
        <span className="h-2 w-2 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
        <span className="h-2 w-2 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
        <span className="h-2 w-2 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
      </div>
      {isSlow && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          模型响应较慢，请耐心等待...或点击取消后重试
        </p>
      )}
    </div>
  );
}
