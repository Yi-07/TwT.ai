"use client";

import { useState, useEffect, useCallback } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("twt-theme", next);
    } catch {
      // localStorage unavailable (private browsing)
    }
    setTheme(next);
  }, [theme]);

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-canvas-soft dark:hover:bg-surface-dark-elevated"
    >
      <span className="sr-only">
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </span>
      {theme === "dark" ? (
        <Sun size={15} className="text-muted-soft transition-transform duration-500 ease-out hover:rotate-90" />
      ) : (
        <Moon size={15} className="text-muted-soft transition-transform duration-500 ease-out hover:-rotate-12" />
      )}
    </button>
  );
}
