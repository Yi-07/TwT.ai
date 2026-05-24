"use client";

import { useState, useEffect, useCallback } from "react";

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

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
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";
  const dur = "600ms";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-canvas-soft active:scale-95 dark:hover:bg-surface-dark-elevated"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 overflow-visible"
        aria-hidden="true"
      >
        {/* Sun rays — rotate ccw + shrink into centre; amber warm gold */}
        <g
          style={{
            color: "#E8A55A",
            transformOrigin: "12px 12px",
            transform: isDark
              ? "rotate(0deg) scale(1)"
              : "rotate(-180deg) scale(0)",
            opacity: isDark ? 1 : 0,
            transition: `transform ${dur} ${ease}, opacity ${dur} ${ease}`,
          }}
        >
          {RAYS.map((deg) => (
            <line
              key={deg}
              x1={12}
              y1={2}
              x2={12}
              y2={4.5}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{
                transformOrigin: "12px 12px",
                transform: `rotate(${deg}deg)`,
              }}
            />
          ))}
        </g>

        {/* Sun body — filled circle, warm amber */}
        <circle
          cx={12}
          cy={12}
          r={5}
          fill="#E8A55A"
          style={{
            opacity: isDark ? 1 : 0,
            transition: `opacity ${dur} ${ease}`,
          }}
        />

        {/* Moon crescent — warm dark grey for light bg */}
        <path
          d="M 12 7 A 5 5 0 0 0 12 17 A 3 3 0 0 1 12 7 Z"
          fill="#3D3D3A"
          style={{
            opacity: isDark ? 0 : 1,
            transition: `opacity ${dur} ${ease}`,
          }}
        />
      </svg>
    </button>
  );
}
