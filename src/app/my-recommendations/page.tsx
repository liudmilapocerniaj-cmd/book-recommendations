"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { BookCover } from "@/components/book-cover";
import { GenreLabel } from "@/components/genre-label";

type Recommendation = {
  id: string;
  user_id: string;
  book_title: string;
  book_author: string;
  description: string;
  cover_url: string | null;
  genre: string | null;
};

export default function MyRecommendationsPage() {
  const router = useRouter();
  const deleting = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function loadRecommendations(requestVersion: number) {
      const isCurrent = () => active && requestVersion === version;
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!isCurrent()) return;
        if (authError) throw authError;
        if (!authData.user) return;
        setSignedIn(true);

        const { data, error } = await supabase
          .from("recommendations")
          .select("id, user_id, book_title, book_author, description, cover_url, genre")
          .eq("user_id", authData.user.id);

        if (!isCurrent()) return;
        if (error) throw error;
        setRecommendations(data ?? []);
      } catch {
        if (isCurrent()) {
          setErrorMessage("Nepavyko įkelti rekomendacijų. Atnaujinkite puslapį ir bandykite dar kartą.");
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const requestVersion = ++version;
      clearTimeout(timer);
      // Clear the previous account's rows immediately, including on logout.
      setRecommendations([]);
      setSignedIn(false);
      setErrorMessage("");
      setLoading(Boolean(session));
      if (session) {
        // Run Auth requests after the Auth event callback has finished.
        timer = setTimeout(() => {
          if (active) void loadRecommendations(requestVersion);
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

  async function deleteRecommendation(book: Recommendation) {
    if (deleting.current || !window.confirm(`Ištrinti „${book.book_title}“? Šio veiksmo atšaukti negalima.`)) return;
    deleting.current = true;
    setDeletingId(book.id);
    setDeleteError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setSignedIn(false);
        setRecommendations([]);
        return;
      }
      const { data, error } = await supabase.from("recommendations")
        .delete().eq("id", book.id).eq("user_id", auth.user.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Rekomendacija nerasta arba neturite teisės jos ištrinti.");
      setRecommendations((rows) => rows.filter((row) => row.id !== book.id));
      router.refresh();
    } catch (error) {
      setDeleteError(uiErrorMessage(error, "Nepavyko ištrinti rekomendacijos."));
    } finally {
      deleting.current = false;
      setDeletingId(null);
    }
  }

  return (
    <main className="recommendations-page my-recommendations-page">
      <header className="homepage-header">
        <Link href="/" className="auth-link">← Visos rekomendacijos</Link>
      </header>
      <h1>Mano rekomendacijos</h1>
      {deleteError && <p className="auth-error" role="alert">{deleteError}</p>}
      {loading ? (
        <p role="status">Įkeliama…</p>
      ) : errorMessage ? (
        <p className="auth-error" role="alert">{errorMessage}</p>
      ) : !signedIn ? (
        <p>Norėdami matyti savo rekomendacijas, <Link href="/login" className="auth-link">prisijunkite</Link>.</p>
      ) : recommendations.length === 0 ? (
        <p>Dar neturite savo rekomendacijų.</p>
      ) : recommendations.map((book) => (
        <div key={book.id} className="recommendation-card recommendation-with-cover">
          <BookCover url={book.cover_url} title={book.book_title} />
          <div className="recommendation-content">
          <h2 className="book-title"><Link href={`/recommendations/${book.id}`} className="recommendation-title-link">{book.book_title}</Link></h2>
          <p className="book-author">{book.book_author}</p>
          <GenreLabel genre={book.genre} />
          <p className="book-description">{book.description}</p>
          <div className="recommendation-actions">
            <Link href={`/recommendations/${book.id}/edit`} className="auth-link">Redaguoti</Link>
            <button type="button" className="auth-link" disabled={deletingId !== null}
              onClick={() => deleteRecommendation(book)}>
              {deletingId === book.id ? "Trinama…" : "Ištrinti"}
            </button>
          </div>
          </div>
        </div>
      ))}
    </main>
  );
}
