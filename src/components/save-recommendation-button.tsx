"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSavedRecommendations } from "@/lib/saved-recommendations-context";
import { uiErrorMessage } from "@/lib/ui-error-message";

export function SaveRecommendationButton({
  recommendationId,
  onSavedChange,
}: {
  recommendationId: string;
  onSavedChange?: (saved: boolean) => void;
}) {
  const router = useRouter();
  const { userId, ready, savedIds, toggleSaved } = useSavedRecommendations();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const saved = savedIds.has(recommendationId);

  async function handleClick() {
    if (pending || !ready) return;
    if (!userId) {
      router.push("/login");
      return;
    }
    setPending(true);
    setError("");
    const nextSaved = !saved;
    try {
      await toggleSaved(recommendationId);
      onSavedChange?.(nextSaved);
    } catch (err) {
      setError(uiErrorMessage(err, saved ? "Nepavyko pašalinti iš sąrašo. Bandykite dar kartą." : "Nepavyko išsaugoti. Bandykite dar kartą."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="save-recommendation">
      <button
        type="button"
        className="save-recommendation-button"
        aria-pressed={saved}
        disabled={pending || !ready}
        onClick={handleClick}
      >
        {saved ? "✓ Išsaugota" : "♡ Noriu perskaityti"}
      </button>
      {error && <p className="save-recommendation-error" role="alert">{error}</p>}
    </div>
  );
}
