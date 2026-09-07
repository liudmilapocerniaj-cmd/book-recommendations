"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { validateResetPassword } from "@/lib/reset-password-validation";
import { PasswordInput } from "@/components/password-input";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const invalidLink = params.has("error") || params.has("error_code") || query.has("error") || query.has("error_code");

    // The existing client reads the recovery session from the email redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(invalidLink ? null : session?.user.id ?? null);
      setReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || saved || !userId) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    const validationError = validateResetPassword(password, confirmation);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    saving.current = true;
    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user || data.user.id !== userId) {
        setUserId(null);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      setSaved(true);
    } catch (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko pakeisti slaptažodžio. Bandykite dar kartą arba paprašykite naujos atkūrimo nuorodos."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="recommendations-page auth-page">
      <Link href="/login" className="auth-link">← Grįžti į prisijungimą</Link>
      <h1>Naujas slaptažodis</h1>
      <section className="recommendation-card auth-card">
        {saved ? (
          <>
            <p role="status">Slaptažodis sėkmingai pakeistas.</p>
            <p className="auth-message"><Link href="/login" className="auth-link">Grįžti į prisijungimą</Link></p>
          </>
        ) : !ready ? <p role="status">Tikrinama atkūrimo nuoroda…</p> : !userId ? (
          <p>Atkūrimo nuoroda negalioja arba jos galiojimas baigėsi. <Link href="/forgot-password" className="auth-link">Gauti naują atkūrimo nuorodą</Link>.</p>
        ) : (
          <form className="auth-form" onSubmit={resetPassword} key={userId}>
            <label htmlFor="password">Naujas slaptažodis</label>
            <PasswordInput id="password" name="password" autoComplete="new-password"
              minLength={8} required disabled={busy} aria-describedby="password-help" />
            <p id="password-help">Slaptažodį turi sudaryti bent 8 simboliai.</p>
            <label htmlFor="confirmation">Pakartokite naują slaptažodį</label>
            <PasswordInput id="confirmation" name="confirmation" autoComplete="new-password"
              minLength={8} required disabled={busy} />
            <button className="auth-button" type="submit" disabled={busy}>
              {busy ? "Saugoma…" : "Išsaugoti naują slaptažodį"}
            </button>
          </form>
        )}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
