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
    // Shared detection logic — fires on both mouseup and touchend.
    const detect = () => {
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
        const range = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer;
        const ancestorEl =
          ancestor instanceof Element ? ancestor : ancestor.parentElement;
        const msgEl = ancestorEl?.closest("[data-message-id]");
        if (!msgEl) {
          hide();
          return;
        }

        const startIn = msgEl.contains(range.startContainer);
        const endIn = msgEl.contains(range.endContainer);
        if (!startIn || !endIn) {
          hide();
          return;
        }

        const rect = range.getBoundingClientRect();
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

    // On mobile, touchend fires first (shows button), then ~300ms later
    // the browser fires synthetic mousedown at the touch point.  Set a
    // flag so handleMouseDown skips the synthetic event.
    let touchFlag = false;

    const onUp = () => {
      touchFlag = true;
      setTimeout(() => {
        touchFlag = false;
      }, 500);
      detect();
    };

    const onSelectionChange = () => {
      // Keep the button position and text in sync while the user drags
      // selection handles on mobile (after the initial long-press).
      if (visibleRef.current) detect();
    };

    const onDown = (e: Event) => {
      if (touchFlag) return; // skip synthetic mousedown after touch
      if (visibleRef.current) {
        const btn = document.getElementById("selection-reply-btn");
        if (btn && !btn.contains(e.target as Node)) {
          hide();
        }
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("selectionchange", onSelectionChange);
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
