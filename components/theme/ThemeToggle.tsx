"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const RAY_COUNT = 8;
const SVG_NS = "http://www.w3.org/2000/svg";

// Stage durations (ms) — kept as constants so setTimeout fallbacks
// always match the CSS transition durations exactly.
const RAYS_DURATION = 550; // opacity 0.35s | transform 0.55s
const BODY_DURATION = 400; // r 0.4s
const MASK_DURATION = 350; // r 0.35s (moon) | r 0.3s (sun)
const FALLBACK_PAD = 100; // safety margin so timer doesn't beat transitionend

function positionRays(
  raysG: SVGGElement,
  inner: number,
  outer: number,
  angleDeg: number,
) {
  Array.from(raysG.children).forEach((line, i) => {
    const a = ((angleDeg + i * (360 / RAY_COUNT)) * Math.PI) / 180;
    line.setAttribute("x1", (Math.cos(a) * inner).toFixed(2));
    line.setAttribute("y1", (Math.sin(a) * inner).toFixed(2));
    line.setAttribute("x2", (Math.cos(a) * outer).toFixed(2));
    line.setAttribute("y2", (Math.sin(a) * outer).toFixed(2));
  });
}

function applyFrame(svg: SVGSVGElement, frame: "sun" | "moon") {
  const raysG = svg.querySelector("#rays") as SVGGElement;
  const body = svg.querySelector("#body") as SVGCircleElement;
  const maskCirc = svg.querySelector("#mask-circle") as SVGCircleElement;

  raysG.style.transition = "none";
  body.style.transition = "none";
  maskCirc.style.transition = "none";

  if (frame === "sun") {
    positionRays(raysG, 10, 15, 0);
    raysG.style.opacity = "1";
    raysG.style.transform = "rotate(0deg)";
    body.setAttribute("r", "7");
    body.setAttribute("fill", "none");
    body.setAttribute("stroke", "currentColor");
    body.setAttribute("stroke-width", "2");
    body.removeAttribute("mask");
    maskCirc.setAttribute("r", "0");
  } else {
    positionRays(raysG, 10, 10, -45);
    raysG.style.opacity = "0";
    raysG.style.transform = "rotate(-45deg)";
    body.setAttribute("r", "9");
    body.setAttribute("fill", "currentColor");
    body.setAttribute("stroke", "none");
    body.setAttribute("stroke-width", "0");
    body.setAttribute("mask", "url(#crescent-mask)");
    maskCirc.setAttribute("r", "8");
  }
}

type Fallback = { cancel: () => void } | null;

function withFallback(
  duration: number,
  animId: number,
  next: () => void,
): Fallback {
  const timer = setTimeout(() => {
    if (!isCurrentAnim(animId)) return;
    next();
  }, duration + FALLBACK_PAD);
  return { cancel: () => clearTimeout(timer) };
}

function animateToMoon(svg: SVGSVGElement, animId: number) {
  const raysG = svg.querySelector("#rays") as SVGGElement;
  const body = svg.querySelector("#body") as SVGCircleElement;
  const maskCirc = svg.querySelector("#mask-circle") as SVGCircleElement;

  // Reset to sun frame so we always start from a clean state
  applyFrame(svg, "sun");
  let fb: Fallback = null;

  // Stage 1: rays fade + rotate ccw
  raysG.style.transition =
    "opacity 0.35s ease-in-out, transform 0.55s ease-in-out";
  raysG.style.opacity = "0";
  raysG.style.transform = "rotate(-45deg)";

  const onRaysDone = () => {
    fb?.cancel();
    raysG.removeEventListener("transitionend", onRaysDoneTransition);
    if (!isCurrentAnim(animId)) return;

    // Stage 2: body swells, switches to filled
    body.style.transition = "r 0.4s cubic-bezier(0.4,0,0.2,1)";
    body.setAttribute("r", "9");
    body.setAttribute("fill", "currentColor");
    body.setAttribute("stroke", "none");
    body.setAttribute("stroke-width", "0");
    body.setAttribute("mask", "url(#crescent-mask)");

    fb = withFallback(BODY_DURATION, animId, onBodyDone);
    body.addEventListener("transitionend", onBodyDoneTransition);
  };

  const onBodyDone = () => {
    fb?.cancel();
    body.removeEventListener("transitionend", onBodyDoneTransition);
    if (!isCurrentAnim(animId)) return;

    // Stage 3: mask circle expands, bites out crescent
    maskCirc.style.transition = "r 0.35s ease-out";
    maskCirc.setAttribute("r", "8");
  };

  const onRaysDoneTransition = (e: TransitionEvent) => {
    if (e.propertyName !== "opacity") return;
    onRaysDone();
  };
  const onBodyDoneTransition = (e2: TransitionEvent) => {
    if (e2.propertyName !== "r") return;
    onBodyDone();
  };

  fb = withFallback(RAYS_DURATION, animId, onRaysDone);
  raysG.addEventListener("transitionend", onRaysDoneTransition);
}

function animateToSun(svg: SVGSVGElement, animId: number) {
  const raysG = svg.querySelector("#rays") as SVGGElement;
  const body = svg.querySelector("#body") as SVGCircleElement;
  const maskCirc = svg.querySelector("#mask-circle") as SVGCircleElement;

  // Reset to moon frame so we always start from a clean state
  applyFrame(svg, "moon");
  let fb: Fallback = null;

  // Stage 1: mask circle retracts
  maskCirc.style.transition = "r 0.3s ease-in";
  maskCirc.setAttribute("r", "0");

  const onMaskDone = () => {
    fb?.cancel();
    maskCirc.removeEventListener("transitionend", onMaskDoneTransition);
    if (!isCurrentAnim(animId)) return;

    // Stage 2: body shrinks, switches to stroke
    body.style.transition = "r 0.4s cubic-bezier(0.4,0,0.2,1)";
    body.setAttribute("r", "7");
    body.setAttribute("fill", "none");
    body.setAttribute("stroke", "currentColor");
    body.setAttribute("stroke-width", "2");
    body.removeAttribute("mask");

    fb = withFallback(BODY_DURATION, animId, onBodyDone);
    body.addEventListener("transitionend", onBodyDoneTransition);
  };

  const onBodyDone = () => {
    fb?.cancel();
    body.removeEventListener("transitionend", onBodyDoneTransition);
    if (!isCurrentAnim(animId)) return;

    // Stage 3: rays expand + rotate cw back
    positionRays(raysG, 10, 15, 0);
    raysG.style.transition =
      "opacity 0.35s ease-in-out, transform 0.55s ease-in-out";
    raysG.style.opacity = "1";
    raysG.style.transform = "rotate(0deg)";
  };

  const onMaskDoneTransition = (e: TransitionEvent) => {
    if (e.propertyName !== "r") return;
    onMaskDone();
  };
  const onBodyDoneTransition = (e2: TransitionEvent) => {
    if (e2.propertyName !== "r") return;
    onBodyDone();
  };

  fb = withFallback(MASK_DURATION, animId, onMaskDone);
  maskCirc.addEventListener("transitionend", onMaskDoneTransition);
}

// Module-level ref shared across animation cycles — reset on each new cycle.
let animIdRef: { current: number } | null = null;
function isCurrentAnim(id: number) {
  return animIdRef?.current === id;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const raysG = svg.querySelector("#rays") as SVGGElement;

    // First mount: build rays DOM + jump to initial frame (no animation)
    if (!raysG.children.length) {
      for (let i = 0; i < RAY_COUNT; i++) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("stroke", "currentColor");
        line.setAttribute("stroke-width", "1.8");
        line.setAttribute("stroke-linecap", "round");
        raysG.appendChild(line);
      }
      applyFrame(svg, isDark ? "moon" : "sun");
      return;
    }

    // Increment animation ID so any in-flight transitionend callbacks
    // from a previous toggle will bail out when they fire.
    animIdRef = { current: (animIdRef?.current ?? 0) + 1 };
    const id = animIdRef.current;

    if (isDark) {
      animateToMoon(svg, id);
    } else {
      animateToSun(svg, id);
    }
  }, [isDark, mounted]);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    // Defer sync disk write so it doesn't block the current frame
    setTimeout(() => {
      try {
        localStorage.setItem("twt-theme", next);
      } catch {
        // localStorage unavailable
      }
    }, 0);
    setTheme(next);
  }, [theme]);

  if (!mounted) {
    return <div className="h-7 w-7" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="flex h-7 w-7 items-center justify-center rounded text-body transition-colors hover:bg-canvas-soft active:scale-95 dark:hover:bg-surface-dark-elevated"
    >
      <svg
        ref={svgRef}
        width="22"
        height="22"
        viewBox="-20 -20 40 40"
        xmlns={SVG_NS}
        aria-hidden="true"
        style={{ overflow: "visible" }}
      >
        <defs>
          <mask id="crescent-mask">
            <rect x="-20" y="-20" width="40" height="40" fill="white" />
            <circle id="mask-circle" cx="7" cy="-2" r="0" fill="black" />
          </mask>
        </defs>
        <g id="rays" />
        <circle id="body" cx="0" cy="0" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );
}
