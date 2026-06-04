"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Pencil, ChevronDown } from "lucide-react";

interface Question {
  question: string;
  options: string[];
}

interface AskCardProps {
  questions: Question[];
  onSelect: (text: string) => void;
  onDismiss: () => void;
}

export function AskCard({ questions, onSelect, onDismiss }: AskCardProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const total = questions.length;

  const current = questions[index]!;

  const handleSelect = useCallback(
    (text: string) => {
      const nextAnswers = { ...answers, [index]: text };
      setAnswers(nextAnswers);
      setSelected(questions[index]!.options.indexOf(text));

      if (index < total - 1) {
        // Not last — advance to next question after a brief highlight
        setTimeout(() => {
          if (!mountedRef.current) return;
          setIndex((i) => i + 1);
          setSelected(null);
          setHoveredIdx(null);
        }, 200);
      } else {
        // Last question — collect all answers and send
        const formatted = questions
          .map((q, i) => {
            const answer = i === index ? text : (nextAnswers[i] ?? "-");
            return `**${q.question}** ${answer}`;
          })
          .join("\n");
        setTimeout(() => {
          if (!mountedRef.current) return;
          onSelect(formatted);
        }, 200);
      }
    },
    [index, total, onSelect, questions, answers],
  );

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customText.trim();
    if (trimmed) {
      const nextAnswers = { ...answers, [index]: trimmed };
      if (index < total - 1) {
        setAnswers(nextAnswers);
        setIndex((i) => i + 1);
        setSelected(null);
        setHoveredIdx(null);
        setCustomText("");
      } else {
        const formatted = questions
          .map((q, i) => {
            const answer = i === index ? trimmed : (nextAnswers[i] ?? "-");
            return `**${q.question}** ${answer}`;
          })
          .join("\n");
        onSelect(formatted);
      }
    }
  }, [customText, index, total, onSelect, questions, answers]);

  const handlePrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
    setSelected(null);
    setHoveredIdx(null);
  }, []);

  const handleNext = useCallback(() => {
    setIndex((i) => (i < total - 1 ? i + 1 : i));
    setSelected(null);
    setHoveredIdx(null);
  }, [total]);

  // Keyboard: ↑↓ to navigate options, Enter to select
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHoveredIdx((prev) => {
          const nxt = prev === null ? 0 : Math.min(prev + 1, current.options.length - 1);
          return nxt;
        });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHoveredIdx((prev) => {
          const nxt = prev === null ? current.options.length - 1 : Math.max(prev - 1, 0);
          return nxt;
        });
      }
      if (e.key === "Enter" && hoveredIdx !== null) {
        e.preventDefault();
        handleSelect(current.options[hoveredIdx]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, hoveredIdx, handleSelect]);

  // Auto-focus custom input on keyboard typing
  useEffect(() => {
    const onType = (e: KeyboardEvent) => {
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        customInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onType);
    return () => window.removeEventListener("keydown", onType);
  }, []);

  const btnNav =
    "flex h-6 w-6 md:h-[26px] md:w-[26px] items-center justify-center rounded transition-colors hover:bg-canvas-soft dark:hover:bg-surface-dark-elevated disabled:opacity-30";

  return (
    <>
      {/* Hint bar */}
      <div className="mx-auto mb-1 hidden w-full max-w-[680px] px-4 text-center text-[11px] text-muted-soft md:block">
        ↑↓ to navigate · Enter to select · or type below
      </div>

      {/* Card */}
      <div
        ref={containerRef}
        className="ask-card mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-lg dark:border-hairline dark:bg-surface-dark-elevated"
        style={{
          animation: "ask-card-enter 0.22s cubic-bezier(0.22,0.68,0,1.2) forwards",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-[0.5px] border-hairline px-4 py-2 dark:border-hairline">
          <span className="text-sm font-medium text-body dark:text-on-dark">
            {current.question}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={index === 0}
              className={btnNav}
              aria-label="Previous question"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <span className="min-w-[3em] text-center text-xs text-muted-soft">
              {index + 1} of {total}
            </span>
            <button
              onClick={handleNext}
              disabled={index === total - 1}
              className={btnNav}
              aria-label="Next question"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={onDismiss}
              className={btnNav}
              aria-label="Dismiss"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="py-1">
          {current.options.map((opt, i) => {
            const isSelected = selected === i;
            const isHovered = hoveredIdx === i;
            return (
              <button
                key={i}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="flex w-full items-center gap-3 border-b-[0.5px] border-hairline px-4 transition-colors last:border-b-0 hover:bg-canvas-soft dark:border-hairline dark:hover:bg-surface-dark"
                style={{
                  height: "var(--ask-option-h, 46px)",
                  animation: `ask-option-in 0.18s ${i * 40}ms ease both`,
                }}
              >
                {/* Number badge */}
                <span
                  className={`inline-flex h-6 w-6 md:h-[24px] md:w-[24px] shrink-0 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : "bg-canvas-soft text-body dark:bg-surface-dark dark:text-on-dark"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-left text-sm md:text-[14px] text-body dark:text-on-dark">
                  {opt}
                </span>
                {(isHovered || isSelected) && (
                  <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    className="-rotate-90 text-muted-soft"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Custom input */}
        <div className="flex items-center gap-3 border-t-[0.5px] border-hairline px-4 py-2 dark:border-hairline">
          <Pencil size={14} strokeWidth={1.5} className="shrink-0 text-muted-soft" />
          <input
            ref={customInputRef}
            type="text"
            placeholder="Something else"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomSubmit();
            }}
            className="flex-1 bg-transparent text-sm text-body outline-none placeholder:text-muted-soft dark:text-on-dark"
          />
          <button
            onClick={onDismiss}
            className="text-xs text-muted-soft transition-colors hover:text-body"
          >
            Skip
          </button>
        </div>
      </div>
    </>
  );
}
