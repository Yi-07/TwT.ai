"use client";

import { useState, useEffect, useCallback } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  const toggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const next = theme === "dark" ? "light" : "dark";

      const apply = () => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("twt-theme", next);
        } catch {
          // localStorage unavailable (private browsing)
        }
        setTheme(next);
      };

      if (!document.startViewTransition) {
        apply();
        return;
      }

      const x = event.clientX;
      const y = event.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      const root = document.documentElement;
      root.style.setProperty("--clip-x", `${x}px`);
      root.style.setProperty("--clip-y", `${y}px`);
      root.style.setProperty("--clip-r", `${endRadius}px`);

      document.startViewTransition(() => apply());
    },
    [theme],
  );

  if (!mounted) {
    return <div className="h-7 w-7" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-canvas-soft active:scale-95 dark:hover:bg-surface-dark-elevated"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {/* Sun — visible in dark mode */}
        <Sun
          size={15}
          strokeWidth={1.75}
          className={`absolute text-body transition-all duration-500 ease-out ${
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          }`}
        />
        {/* Moon — visible in light mode */}
        <Moon
          size={15}
          strokeWidth={1.75}
          className={`absolute text-body transition-all duration-500 ease-out ${
            isDark
              ? "-rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}
