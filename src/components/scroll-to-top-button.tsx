"use client";

import { useSyncExternalStore } from "react";

const SCROLL_TOP_THRESHOLD = 600;

function subscribe(onScroll: () => void) {
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

function getSnapshot() {
  return window.scrollY > SCROLL_TOP_THRESHOLD;
}

function getServerSnapshot() {
  return false;
}

export function ScrollToTopButton() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-to-top-button"
      aria-label="Grįžti į viršų"
      title="Grįžti į viršų"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
