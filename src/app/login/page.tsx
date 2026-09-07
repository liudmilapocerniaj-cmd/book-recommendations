"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setReady(true);
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setErrorMessage("");

    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = registering
        ? await supabase.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: `${window.location.origin}/login` },
          })
        : await supabase.auth.signInWithPassword(credentials);

      if (error) throw error;
      setUser(data.user && data.session ? data.user : null);
      setPassword("");
      setMessage(registering && !data.session
        ? "Prieš prisijungdami patvirtinkite el. pašto adresą – paspauskite gautame laiške esančią nuorodą."
        : "Sėkmingai prisijungėte.");
    } catch (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko prisijungti arba sukurti paskyros. Bandykite dar kartą."));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      setUser(null);
      setPassword("");
      setRegistering(false);
      setMessage("Sėkmingai atsijungėte.");
    } catch (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko atsijungti. Bandykite dar kartą."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="recommendations-page auth-page">
      <Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link>
      <h1>{user ? "Mano paskyra" : registering ? "Sukurti paskyrą" : "Prisijungti"}</h1>
      <section className="recommendation-card auth-card" aria-label="Prisijungimas ir paskyra">
        {!ready ? <p role="status">Tikrinama, ar esate prisijungę…</p> : user ? (
          <>
            <p>Esate prisijungę kaip <strong>{user.email}</strong></p>
            <p className="auth-message"><Link href="/profile" className="auth-link">Redaguoti viešą profilį</Link></p>
            <button className="auth-button" onClick={handleLogout} disabled={busy}>
              {busy ? "Atsijungiama…" : "Atsijungti"}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="email">El. paštas</label>
            <input id="email" name="email" type="email" autoComplete="email"
              required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
            <label htmlFor="password">Slaptažodis</label>
            <PasswordInput key={registering ? "register" : "login"} id="password" name="password"
              autoComplete={registering ? "new-password" : "current-password"}
              minLength={registering ? 6 : undefined} required value={password}
              onChange={(event) => setPassword(event.target.value)} disabled={busy} />
            <button className="auth-button" type="submit" disabled={busy}>
              {busy ? "Palaukite…" : registering ? "Sukurti paskyrą" : "Prisijungti"}
            </button>
            <button className="auth-link" type="button" disabled={busy} onClick={() => {
              setRegistering(!registering);
              setPassword("");
              setMessage("");
              setErrorMessage("");
            }}>
              {registering ? "Jau turite paskyrą? Prisijunkite" : "Dar neturite paskyros? Susikurkite"}
            </button>
            <Link href="/forgot-password" className="auth-link">Pamiršau slaptažodį</Link>
          </form>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
