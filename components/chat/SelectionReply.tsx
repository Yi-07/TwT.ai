"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { InputBarHandle } from "./InputBar";
import { Reply } from "lucide-react";

interface SelectionReplyProps {
  /** The InputBar's imperative handle — used to focus + append quoted text. */
  inputRef: React.RefObject<InputBarHandle | null>;
}

interface ButtonPos {
  top: number;
  left: number;
}

const BTN_WIDTH = 64;
const BTN_HEIGHT = 32;
const GAP = 8;

export function SelectionReply({ inputRef }: SelectionReplyProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<ButtonPos>({ top: 0, left: 0 });
  const selectedTextRef = useRef("");
  const visibleRef = useRef(false);

  const hide = useCallback(() => {
    setVisible(false);
    visibleRef.current = false;
    selectedTextRef.current = "";
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      // requestAnimationFrame is more reliable than setTimeout(0) —
      // the browser has always committed the selection by the next frame.
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          hide();
          return;
        }

        const text = sel.toString().trim();
        if (!text) {
          hide();
          return;
        }

        // Ensure the selection is within a single message bubble.
        // commonAncestorContainer may be a text node — walk up to its
        // parent element before calling closest().
        const range = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer;
        const ancestorEl =
          ancestor instanceof Element ? ancestor : ancestor.parentElement;
        const msgEl = ancestorEl?.closest("[data-message-id]");
        if (!msgEl) {
          hide();
          return;
        }

        // Both anchor AND focus must be inside the same message bubble.
        const startIn = msgEl.contains(range.startContainer);
        const endIn = msgEl.contains(range.endContainer);
        if (!startIn || !endIn) {
          hide();
          return;
        }

        const rect = range.getBoundingClientRect();
        // Prefer top-right of selection, fallback to bottom-right
        let top = rect.top - GAP - BTN_HEIGHT;
        let left = rect.right - BTN_WIDTH;
        if (top < GAP) top = rect.bottom + GAP;
        if (left < GAP) left = GAP;
        if (left + BTN_WIDTH > window.innerWidth - GAP)
          left = window.innerWidth - GAP - BTN_WIDTH;

        selectedTextRef.current = text.slice(0, 2000);
        setPos({ top, left });
        setVisible(true);
        visibleRef.current = true;
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (visibleRef.current) {
        const btn = document.getElementById("selection-reply-btn");
        if (btn && !btn.contains(e.target as Node)) {
          hide();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hide]);

  const handleReply = useCallback(() => {
    const quoted = selectedTextRef.current
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    // Append — never overwrite what the user has already typed.
    inputRef.current?.appendText(`\n${quoted}\n\n`);
    inputRef.current?.focus();
    window.getSelection()?.removeAllRanges();
    hide();
  }, [inputRef, hide]);

  if (!visible) return null;

  // Portal to document.body so the button's "fixed" positioning is always
  // relative to the viewport, never distorted by ancestor transforms
  // (e.g. the animate-fade-in wrapper's translateY(0) GPU layer).
  return createPortal(
    <button
      id="selection-reply-btn"
      onClick={handleReply}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[60] flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-sm font-medium text-body shadow-md transition-colors hover:bg-canvas-card hover:text-ink dark:border-hairline dark:bg-surface-dark-elevated dark:text-on-dark dark:hover:bg-surface-dark dark:hover:text-on-dark"
    >
      <Reply size={13} strokeWidth={1.5} />
      Reply
    </button>,
    document.body,
  );
}
