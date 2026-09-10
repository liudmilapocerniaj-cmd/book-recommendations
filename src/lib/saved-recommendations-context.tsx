"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type SavedRecommendationsContextValue = {
  userId: string | null;
  ready: boolean;
  savedIds: Set<string>;
  toggleSaved: (recommendationId: string) => Promise<void>;
};

const SavedRecommendationsContext = createContext<SavedRecommendationsContextValue | null>(null);

export function SavedRecommendationsProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);
  const savedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    savedIdsRef.current = savedIds;
  }, [savedIds]);

  useEffect(() => {
    let active = true;
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function loadSavedIds(uid: string, requestVersion: number) {
      const isCurrent = () => active && requestVersion === version;
      const { data, error } = await supabase
        .from("saved_recommendations")
        .select("recommendation_id")
        .eq("user_id", uid);
      if (!isCurrent()) return;
      if (!error) setSavedIds(new Set((data ?? []).map((row) => row.recommendation_id)));
      setReady(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const requestVersion = ++version;
      clearTimeout(timer);
      const uid = session?.user?.id ?? null;
      // Clear the previous account's saved state immediately, including on logout.
      setUserId(uid);
      setSavedIds(new Set());
      setReady(!uid);
      if (uid) {
        // Run Auth-dependent requests after the Auth event callback has finished.
        timer = setTimeout(() => {
          if (active) void loadSavedIds(uid, requestVersion);
        }, 0);
      }
    });

    return () => {
      active = false;
      version++;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function toggleSaved(recommendationId: string) {
    const uid = userIdRef.current;
    if (!uid) throw new Error("not-signed-in");
    const isSaved = savedIdsRef.current.has(recommendationId);

    if (isSaved) {
      const { error } = await supabase
        .from("saved_recommendations")
        .delete()
        .eq("user_id", uid)
        .eq("recommendation_id", recommendationId);
      if (error) throw error;
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(recommendationId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("saved_recommendations")
        .insert({ user_id: uid, recommendation_id: recommendationId });
      // 23505 = unique_violation: already saved (e.g. a duplicate click that raced
      // ahead of the local state update). Treat the desired end state as reached.
      if (error && error.code !== "23505") throw error;
      setSavedIds((prev) => new Set(prev).add(recommendationId));
    }
  }

  return (
    <SavedRecommendationsContext.Provider value={{ userId, ready, savedIds, toggleSaved }}>
      {children}
    </SavedRecommendationsContext.Provider>
  );
}

export function useSavedRecommendations() {
  const context = useContext(SavedRecommendationsContext);
  if (!context) throw new Error("useSavedRecommendations must be used within SavedRecommendationsProvider");
  return context;
}
