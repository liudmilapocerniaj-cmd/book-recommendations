"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const sending = useRef(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    sending.current = true;
    setBusy(true);
    setSent(false);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko išsiųsti atkūrimo nuorodos. Bandykite dar kartą."));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="recommendations-page auth-page">
      <Link href="/login" className="auth-link">← Grįžti į prisijungimą</Link>
      <h1>Slaptažodžio atkūrimas</h1>
      <section className="recommendation-card auth-card">
        <form className="auth-form" onSubmit={requestReset}>
          <p>Įveskite savo el. pašto adresą.</p>
          <label htmlFor="email">El. paštas</label>
          <input id="email" name="email" type="email" autoComplete="email" required disabled={busy} />
          <button className="auth-button" type="submit" disabled={busy}>
            {busy ? "Siunčiama…" : "Siųsti atkūrimo nuorodą"}
          </button>
        </form>
        {sent && <p className="auth-message" role="status">Jei šiuo el. pašto adresu yra registruota paskyra, į jį išsiųsta slaptažodžio atkūrimo nuoroda. Patikrinkite ir brukalo aplanką.</p>}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
