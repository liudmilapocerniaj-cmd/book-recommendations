"use client";

import { useEffect } from "react";

export function CommentsHashScroll() {
  useEffect(() => {
    // Retry after the detail page commits, in case the router scrolled before
    // the comments anchor was available. Also covers direct URL hydration.
    const frame = window.requestAnimationFrame(() => {
      if (window.location.hash === "#comments") {
        document.getElementById("comments")?.scrollIntoView({ block: "start" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}
