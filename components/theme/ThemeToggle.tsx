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

  const toggle = useCallback(() => {
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

    // View Transitions API — native crossfade + zoom for Chrome
    if (document.startViewTransition) {
      document.startViewTransition(() => apply());
    } else {
      apply();
    }
  }, [theme]);

  if (!mounted) {
    // Prevent hydration mismatch by rendering a placeholder of the same size
    return <div className="h-7 w-7" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-canvas-soft active:scale-95 dark:hover:bg-surface-dark-elevated"
    >
      <span className="sr-only">
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </span>
      <span className="relative flex h-4 w-4 items-center justify-center">
        {/* Sun — visible in dark mode, hidden in light */}
        <Sun
          size={15}
          className={`absolute text-muted-soft transition-all duration-500 ease-out ${
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          }`}
        />
        {/* Moon — visible in light mode, hidden in dark */}
        <Moon
          size={15}
          className={`absolute text-muted-soft transition-all duration-500 ease-out ${
            isDark
              ? "-rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}
