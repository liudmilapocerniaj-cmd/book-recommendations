"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useSavedRecommendations } from "@/lib/saved-recommendations-context";
import { uiErrorMessage } from "@/lib/ui-error-message";

function subscribeNoop() {
  return () => {};
}

// The server always renders as signed-out (no access to browser auth storage).
// getServerSnapshot reports "not mounted" for both the SSR render and the client's
// first hydration pass, then the client-only getSnapshot flips it after mount, so
// the very first client render matches the server HTML exactly.
function useHasMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

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
  const hasMounted = useHasMounted();
  const saved = hasMounted && savedIds.has(recommendationId);

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
        disabled={hasMounted && (pending || !ready)}
        onClick={handleClick}
      >
        {saved ? "✓ Išsaugota" : "♡ Noriu perskaityti"}
      </button>
      {error && <p className="save-recommendation-error" role="alert">{error}</p>}
    </div>
  );
}
