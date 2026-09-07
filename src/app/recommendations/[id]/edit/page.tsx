"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { getCoverUrl } from "@/lib/cover-url";
import { genres } from "@/lib/genres";
import { GenreSelect } from "@/components/genre-select";

type Book = { id: string; user_id: string; book_title: string; book_author: string; description: string; cover_url: string | null; genre: string | null };

export default function EditRecommendationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load(current: number) {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!active || current !== version) return;
        if (authError || !auth.user) return;
        setSignedIn(true);
        const { data, error } = await supabase.from("recommendations")
          .select("id, user_id, book_title, book_author, description, cover_url, genre")
          .eq("id", id).eq("user_id", auth.user.id).maybeSingle();
        if (!active || current !== version) return;
        if (error) throw error;
        setBook(data);
      } catch {
        if (active && current === version) setErrorMessage("Nepavyko įkelti rekomendacijos.");
      } finally {
        if (active && current === version) setLoading(false);
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++version;
      clearTimeout(timer);
      setBook(null);
      setSignedIn(false);
      setErrorMessage("");
      setLoading(Boolean(session));
      if (session) timer = setTimeout(() => { if (active) void load(current); }, 0);
    });
    return () => { active = false; version++; clearTimeout(timer); subscription.unsubscribe(); };
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!book || saving.current) return;
    const values = new FormData(event.currentTarget);
    const genre = String(values.get("genre") ?? "");
    if (genre && !genres.includes(genre)) {
      setErrorMessage("Pasirinkite žanrą iš sąrašo.");
      return;
    }
    const coverInput = String(values.get("cover_url") ?? "").trim();
    const cover_url = getCoverUrl(coverInput);
    if (coverInput && !cover_url) {
      setErrorMessage("Įveskite galiojančią viršelio nuorodą, prasidedančią https:// arba http://.");
      return;
    }
    const updates = {
      book_title: String(values.get("book_title") ?? "").trim(),
      book_author: String(values.get("book_author") ?? "").trim(),
      description: String(values.get("description") ?? "").trim(),
    };
    if (Object.values(updates).some((value) => !value)) {
      setErrorMessage("Užpildykite visus laukus.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setErrorMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setSignedIn(false);
        setBook(null);
        return;
      }
      if (auth.user.id !== book.user_id) throw new Error("Neturite teisės redaguoti šios rekomendacijos.");
      const { data, error } = await supabase.from("recommendations").update({ ...updates, cover_url, genre: genre || null })
        .eq("id", id).eq("user_id", auth.user.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Rekomendacija nerasta arba pakeitimai neleidžiami.");
      router.push("/my-recommendations");
      router.refresh();
    } catch (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko išsaugoti pakeitimų."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="recommendations-page auth-page">
      <Link href="/my-recommendations" className="auth-link">← Mano rekomendacijos</Link>
      <h1>Redaguoti rekomendaciją</h1>
      <section className="recommendation-card auth-card">
        {loading ? <p role="status">Įkeliama…</p> : !signedIn ? (
          <p>Norėdami redaguoti, <Link href="/login" className="auth-link">prisijunkite</Link>.</p>
        ) : !book ? <p>Rekomendacija nerasta arba ji priklauso kitam naudotojui.</p> : (
          <form className="auth-form" onSubmit={save} key={`${book.id}:${book.user_id}`}>
            <label htmlFor="book_title">Knygos pavadinimas</label>
            <input id="book_title" name="book_title" defaultValue={book.book_title} required disabled={busy} />
            <label htmlFor="book_author">Knygos autorius</label>
            <input id="book_author" name="book_author" defaultValue={book.book_author} required disabled={busy} />
            <label htmlFor="description">Kodėl rekomenduoji šią knygą?</label>
            <textarea id="description" name="description" defaultValue={book.description} rows={5} required disabled={busy} />
            <GenreSelect value={book.genre} disabled={busy} />
            <label htmlFor="cover_url">Knygos viršelio nuoroda</label>
            <input id="cover_url" name="cover_url" type="url" placeholder="https://..."
              defaultValue={book.cover_url ?? ""} disabled={busy} aria-describedby="cover-help" />
            <p id="cover-help">Neprivaloma. Norėdami pašalinti viršelį, ištrinkite nuorodą.</p>
            <button className="auth-button" type="submit" disabled={busy}>{busy ? "Saugoma…" : "Išsaugoti pakeitimus"}</button>
          </form>
        )}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
