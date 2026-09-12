"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReadingListNavLink } from "@/components/reading-list-nav-link";
import { NotificationsNavLink } from "@/components/notifications-nav-link";

export function SiteHeaderNav({ recommendationIds }: { recommendationIds: string[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function openRandomRecommendation() {
    if (recommendationIds.length === 0) return;

    const id = recommendationIds[Math.floor(Math.random() * recommendationIds.length)];
    setOpen(false);
    router.push(`/recommendations/${id}`);
  }

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Meniu
      </button>
      <nav id="site-nav" aria-label="Pagrindinė navigacija" className={open ? "nav-open" : undefined}
        onClick={() => setOpen(false)}>
        <button
          type="button"
          className="nav-link nav-action"
          disabled={recommendationIds.length === 0}
          onClick={openRandomRecommendation}
        >
          Atsitiktinė knyga
        </button>
        <Link href="/authors" className="nav-link">Autoriai</Link>
        <Link href="/genres" className="nav-link">Žanrai</Link>
        <Link href="/my-recommendations" className="nav-link">
          Mano rekomendacijos
        </Link>
        <ReadingListNavLink />
        <NotificationsNavLink />
        <Link href="/recommendations/new" className="nav-link nav-recommend">
          + Rekomenduoti
        </Link>
        <Link href="/login" className="nav-link">
          Mano paskyra
        </Link>
      </nav>
    </>
  );
}
