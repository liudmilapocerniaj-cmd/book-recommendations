"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { getCoverUrl } from "@/lib/cover-url";
import { genres } from "@/lib/genres";
import { GenreSelect } from "@/components/genre-select";

export default function NewRecommendationPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    let version = 0;

    async function checkUser() {
      const currentVersion = ++version;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active || currentVersion !== version) return;
        setUser(error ? null : data.user);
      } catch {
        if (!active || currentVersion !== version) return;
        setUser(null);
        setErrorMessage("Nepavyko patikrinti paskyros. Atnaujinkite puslapį ir bandykite dar kartą.");
      } finally {
        if (active && currentVersion === version) setReady(true);
      }
    }

    // Defer Auth requests until after the Auth event callback completes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        version++;
        setUser(null);
        setReady(true);
        return;
      }
      window.setTimeout(() => { if (active) void checkUser(); }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || saved) return;
    const form = new FormData(event.currentTarget);
    const book_title = String(form.get("book_title") ?? "").trim();
    const book_author = String(form.get("book_author") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const genre = String(form.get("genre") ?? "");
    if (genre && !genres.includes(genre)) {
      setErrorMessage("Pasirinkite žanrą iš sąrašo.");
      return;
    }
    const coverInput = String(form.get("cover_url") ?? "").trim();
    const cover_url = getCoverUrl(coverInput);
    if (coverInput && !cover_url) {
      setErrorMessage("Įveskite galiojančią viršelio nuorodą, prasidedančią https:// arba http://.");
      return;
    }

    if (!book_title || !book_author || !description) {
      setErrorMessage("Užpildykite pavadinimą, autorių ir rekomendacijos tekstą. Vien tarpų nepakanka.");
      return;
    }

    submitting.current = true;
    setBusy(true);
    setErrorMessage("");
    try {
      // Verify again at submission time; never accept an owner ID from the form.
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setUser(null);
        throw new Error("Prieš kurdami rekomendaciją prisijunkite iš naujo.");
      }

      const { error } = await supabase.from("recommendations").insert({
        book_title,
        book_author,
        description,
        cover_url,
        genre: genre || null,
        user_id: authData.user.id,
      });
      if (error) throw error;
      setSaved(true);
    } catch (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko išsaugoti rekomendacijos. Bandykite dar kartą."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="recommendations-page auth-page">
      <Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link>
      <h1>Nauja rekomendacija</h1>
      <section className="recommendation-card auth-card" aria-label="Rekomendacijos kūrimas">
        {saved ? (
          <>
            <p role="status">Rekomendacija sėkmingai išsaugota.</p>
            <p className="auth-message">
              <button type="button" className="auth-link" onClick={() => {
                router.push("/");
                router.refresh();
              }}>
                Peržiūrėti rekomendacijas →
              </button>
            </p>
          </>
        ) : !ready ? (
          <p role="status">Tikrinama, ar esate prisijungę…</p>
        ) : !user ? (
          <p>Norėdami sukurti rekomendaciją, <Link href="/login" className="auth-link">prisijunkite</Link>.</p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="book_title">Knygos pavadinimas</label>
            <input id="book_title" name="book_title" required disabled={busy} />
            <label htmlFor="book_author">Knygos autorius</label>
            <input id="book_author" name="book_author" required disabled={busy} />
            <label htmlFor="description">Kodėl rekomenduoji šią knygą?</label>
            <textarea id="description" name="description" rows={5} required disabled={busy}
              placeholder="Kas tau joje labiausiai patiko ir kam ją rekomenduotum?" />
            <GenreSelect disabled={busy} />
            <label htmlFor="cover_url">Knygos viršelio nuoroda</label>
            <input id="cover_url" name="cover_url" type="url" placeholder="https://..."
              disabled={busy} aria-describedby="cover-help" />
            <p id="cover-help">Neprivaloma. Įklijuokite tiesioginę paveikslėlio nuorodą.</p>
            <button className="auth-button" type="submit" disabled={busy}>
              {busy ? "Saugoma…" : "Išsaugoti rekomendaciją"}
            </button>
          </form>
        )}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
