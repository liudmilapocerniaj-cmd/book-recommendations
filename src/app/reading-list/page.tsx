"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { BookCover } from "@/components/book-cover";
import { GenreLabel } from "@/components/genre-label";
import { Recommender } from "@/components/recommender";
import { SaveRecommendationButton } from "@/components/save-recommendation-button";
import { loadProfileNames } from "@/lib/public-profiles";
import { loadSavedRecommendations, type SavedRecommendation } from "@/lib/saved-recommendations";

export default function ReadingListPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [books, setBooks] = useState<SavedRecommendation[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load(userId: string, requestVersion: number) {
      const isCurrent = () => active && requestVersion === version;
      try {
        const data = await loadSavedRecommendations(userId);
        if (!isCurrent()) return;
        setBooks(data);
        const names = await loadProfileNames(data.map((book) => book.user_id));
        if (!isCurrent()) return;
        setProfileNames(names);
      } catch (error) {
        if (isCurrent()) {
          setErrorMessage(uiErrorMessage(error, "Nepavyko įkelti sąrašo. Atnaujinkite puslapį ir bandykite dar kartą."));
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const requestVersion = ++version;
      clearTimeout(timer);
      const uid = session?.user?.id ?? null;
      // Clear the previous account's list immediately, including on logout.
      setBooks([]);
      setErrorMessage("");
      setSignedIn(Boolean(uid));
      setLoading(Boolean(uid));
      if (uid) {
        // Run Auth-dependent requests after the Auth event callback has finished.
        timer = setTimeout(() => {
          if (active) void load(uid, requestVersion);
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

  function handleRemoved(id: string) {
    setBooks((rows) => rows.filter((book) => book.id !== id));
  }

  return (
    <main className="recommendations-page my-recommendations-page">
      <header className="homepage-header">
        <Link href="/" className="auth-link">← Visos rekomendacijos</Link>
      </header>
      <h1>Noriu perskaityti</h1>
      {loading ? (
        <p role="status">Įkeliama…</p>
      ) : errorMessage ? (
        <p className="auth-error" role="alert">{errorMessage}</p>
      ) : !signedIn ? (
        <p>Norėdami matyti savo sąrašą, <Link href="/login" className="auth-link">prisijunkite</Link>.</p>
      ) : books.length === 0 ? (
        <p>Dar neišsaugojote knygų, kurias norite perskaityti.</p>
      ) : books.map((book) => (
        <div key={book.id} className="recommendation-card recommendation-with-cover">
          <BookCover url={book.cover_url} title={book.book_title} />
          <div className="recommendation-content">
            <h2 className="book-title">
              <Link href={`/recommendations/${book.id}`} className="recommendation-title-link">{book.book_title}</Link>
            </h2>
            <p className="book-author">{book.book_author}</p>
            <GenreLabel genre={book.genre} />
            <p className="book-description">{book.description}</p>
            <Recommender userId={book.user_id} name={profileNames[book.user_id]} />
            <SaveRecommendationButton
              recommendationId={book.id}
              onSavedChange={(saved) => { if (!saved) handleRemoved(book.id); }}
            />
          </div>
        </div>
      ))}
    </main>
  );
}
