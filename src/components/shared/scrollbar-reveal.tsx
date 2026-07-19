"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const HIDE_DELAY_MS = 900;
const THUMB_WIDTH = 7;
const EDGE_INSET = 6;
const MIN_THUMB_HEIGHT = 48;
const HOME_SCROLL_CLASS = "home-floating-scroll";

type ThumbMetrics = {
  top: number;
  height: number;
  right: number;
  visible: boolean;
};

function computeThumb(): Omit<ThumbMetrics, "visible"> | null {
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = window.innerHeight;
  const scrollTop = window.scrollY;

  if (scrollHeight <= clientHeight + 1) return null;

  const thumbHeight = Math.max(MIN_THUMB_HEIGHT, (clientHeight / scrollHeight) * clientHeight);
  const scrollable = scrollHeight - clientHeight;
  const ratio = scrollable > 0 ? scrollTop / scrollable : 0;
  const maxThumbTop = clientHeight - thumbHeight;

  return {
    top: ratio * maxThumbTop,
    height: thumbHeight,
    right: EDGE_INSET,
  };
}

/** Floating green scrollbar — home/dashboard only */
export function ScrollbarReveal() {
  const [mounted, setMounted] = useState(false);
  const [thumb, setThumb] = useState<ThumbMetrics | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add(HOME_SCROLL_CLASS);
    return () => {
      document.documentElement.classList.remove(HOME_SCROLL_CLASS);
    };
  }, []);

  useEffect(() => {
    const reveal = () => {
      const metrics = computeThumb();
      if (!metrics) {
        setThumb(null);
        return;
      }

      setThumb({ ...metrics, visible: true });

      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setThumb((prev) => (prev ? { ...prev, visible: false } : null));
      }, HIDE_DELAY_MS);
    };

    window.addEventListener("scroll", reveal, { passive: true });
    window.addEventListener("resize", reveal, { passive: true });

    return () => {
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("resize", reveal);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!mounted || !thumb) return null;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-[9999] rounded-full bg-emerald-600 transition-opacity duration-300 ease-out dark:bg-emerald-400"
      style={{
        width: THUMB_WIDTH,
        right: thumb.right,
        top: thumb.top,
        height: thumb.height,
        opacity: thumb.visible ? 1 : 0,
      }}
    />,
    document.body
  );
}
