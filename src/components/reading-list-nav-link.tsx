"use client";

import Link from "next/link";
import { useSavedRecommendations } from "@/lib/saved-recommendations-context";

export function ReadingListNavLink() {
  const { userId } = useSavedRecommendations();
  if (!userId) return null;
  return <Link href="/reading-list" className="nav-link">Noriu perskaityti</Link>;
}
