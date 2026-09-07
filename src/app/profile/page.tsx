"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";

type Profile = { display_name: string; bio: string | null };

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
        setUserId(auth.user.id);
        const { data, error } = await supabase.from("profiles")
          .select("display_name, bio").eq("id", auth.user.id).maybeSingle();
        if (!active || current !== version) return;
        if (error) throw error;
        setProfile(data ?? { display_name: "", bio: "" });
      } catch {
        if (active && current === version) setErrorMessage("Nepavyko įkelti profilio. Bandykite dar kartą.");
      } finally {
        if (active && current === version) setLoading(false);
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++version;
      clearTimeout(timer);
      setUserId(null);
      setProfile(null);
      setMessage("");
      setErrorMessage("");
      setLoading(Boolean(session));
      if (session) timer = setTimeout(() => { if (active) void load(current); }, 0);
    });
    return () => { active = false; version++; clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving.current) return;
    const fields = new FormData(event.currentTarget);
    const display_name = String(fields.get("display_name") ?? "").trim();
    const bio = String(fields.get("bio") ?? "").trim();
    if (!display_name || display_name.length > 80 || bio.length > 1000) {
      setErrorMessage("Įveskite vardą iki 80 simbolių ir aprašymą iki 1000 simbolių.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setErrorMessage("");
    setMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user || auth.user.id !== userId) {
        setUserId(null);
        setProfile(null);
        return;
      }
      const { data, error } = await supabase.from("profiles")
        .upsert({ id: auth.user.id, display_name, bio: bio || null }, { onConflict: "id" })
        .select("id").single();
      if (error || !data) throw error;
      setMessage("Profilis išsaugotas.");
    } catch (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko išsaugoti profilio. Bandykite dar kartą."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="recommendations-page auth-page">
      <Link href="/login" className="auth-link">← Mano paskyra</Link>
      <h1>Mano profilis</h1>
      <section className="recommendation-card auth-card">
        {loading ? <p role="status">Įkeliama…</p> : !userId ? (
          <p>Norėdami redaguoti profilį, <Link href="/login" className="auth-link">prisijunkite</Link>.</p>
        ) : profile && (
          <form className="auth-form" onSubmit={save} key={userId}>
            <p>Vardas ir aprašymas bus matomi visiems. El. pašto čia nerašykite.</p>
            <label htmlFor="display_name">Viešas vardas</label>
            <input id="display_name" name="display_name" defaultValue={profile.display_name} required maxLength={80} disabled={busy} />
            <label htmlFor="bio">Apie mane (neprivaloma)</label>
            <textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} rows={4} maxLength={1000} disabled={busy} />
            <button className="auth-button" type="submit" disabled={busy}>{busy ? "Saugoma…" : "Išsaugoti profilį"}</button>
            <Link href={`/users/${userId}`} className="auth-link">Peržiūrėti viešą profilį</Link>
          </form>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
