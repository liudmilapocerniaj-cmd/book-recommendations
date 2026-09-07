"use client";

import { useState } from "react";
import { getCoverUrl } from "@/lib/cover-url";

export function BookCover({ url, title }: { url?: string | null; title: string }) {
  const source = getCoverUrl(url);
  return <CoverImage key={source ?? "empty"} source={source} title={title} />;
}

function CoverImage({ source, title }: { source: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="book-cover">
      {source && !failed ? (
        // User-provided URLs load directly in the browser, without an image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt={`Knygos „${title}“ viršelis`} width={160} height={240}
          loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span className="book-cover-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" aria-hidden="true">
            <path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M5 3v14h14 M3 19a2 2 0 0 1 2-2" />
          </svg>
          Viršelio nėra
        </span>
      )}
    </div>
  );
}
