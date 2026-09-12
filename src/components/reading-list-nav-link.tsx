"use client";

import Link from "next/link";
import { useSavedRecommendations } from "@/lib/saved-recommendations-context";

export function ReadingListNavLink() {
  const { userId, ready, savedIds } = useSavedRecommendations();
  if (!userId) return null;
  const savedCount = ready ? savedIds.size : 0;

  return (
    <Link
      href="/reading-list"
      className="nav-link"
      aria-label={savedCount > 0 ? `Noriu perskaityti, išsaugotų knygų: ${savedCount}` : undefined}
    >
      Noriu perskaityti{savedCount > 0 && <span className="nav-badge" aria-hidden="true">{savedCount}</span>}
    </Link>
  );
}
