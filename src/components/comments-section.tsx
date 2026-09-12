"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { loadProfileNames } from "@/lib/public-profiles";
import { uiErrorMessage } from "@/lib/ui-error-message";
import type { Comment } from "@/lib/comments";

const MAX_LENGTH = 1000;

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

function formatCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Vilnius" }).format(date);
}

export function CommentsSection({
  recommendationId,
  initialComments,
  initialNames,
}: {
  recommendationId: string;
  initialComments: Comment[];
  initialNames: Record<string, string>;
}) {
  const hasMounted = useHasMounted();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [names, setNames] = useState(initialNames);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const showForm = hasMounted && ready && Boolean(userId);
  const trimmedLength = content.trim().length;
  const overLimit = trimmedLength > MAX_LENGTH;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !userId) return;
    const trimmed = content.trim();
    if (!trimmed) {
      setSubmitError("Įveskite komentarą.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setSubmitError("Komentaras per ilgas. Sutrumpinkite iki 1000 simbolių.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({ recommendation_id: recommendationId, user_id: userId, content: trimmed })
        .select("id, user_id, content, created_at")
        .single();
      if (error) throw error;
      setComments((rows) => [...rows, data]);
      setContent("");
      if (!names[userId]) {
        const loaded = await loadProfileNames([userId]);
        setNames((prev) => ({ ...prev, ...loaded }));
      }
    } catch (error) {
      setSubmitError(uiErrorMessage(error, "Nepavyko paskelbti komentaro. Bandykite dar kartą."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleDelete(comment: Comment) {
    if (deletingRef.current || !userId) return;
    if (!window.confirm("Ištrinti šį komentarą? Šio veiksmo atšaukti negalima.")) return;
    deletingRef.current = true;
    setDeletingId(comment.id);
    setDeleteError("");
    try {
      const { data, error } = await supabase
        .from("comments")
        .delete()
        .eq("id", comment.id)
        .eq("user_id", userId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Nepavyko ištrinti komentaro. Bandykite dar kartą.");
      setComments((rows) => rows.filter((row) => row.id !== comment.id));
    } catch (error) {
      setDeleteError(uiErrorMessage(error, "Nepavyko ištrinti komentaro. Bandykite dar kartą."));
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  return (
    <section className="comments-section" aria-labelledby="comments-heading">
      <h2 id="comments-heading">Komentarai ({comments.length})</h2>

      {comments.length === 0 ? (
        <p className="comments-empty">Komentarų dar nėra. Būkite pirmas, kuris pasidalins mintimis.</p>
      ) : (
        <ul className="comments-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment-item">
              <p className="comment-author">{names[comment.user_id] || "Skaitytojas"}</p>
              <p className="comment-content">{comment.content}</p>
              <div className="comment-meta">
                <time dateTime={comment.created_at}>{formatCommentDate(comment.created_at)}</time>
                {hasMounted && userId === comment.user_id && (
                  <button
                    type="button"
                    className="auth-link comment-delete"
                    disabled={deletingId !== null}
                    onClick={() => handleDelete(comment)}
                  >
                    {deletingId === comment.id ? "Trinama…" : "Ištrinti"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleteError && <p className="auth-error" role="alert">{deleteError}</p>}

      <div className="comment-form-wrapper">
        <h3 id="comment-form-heading">Parašyti komentarą</h3>
        {showForm ? (
          <form className="comment-form" onSubmit={handleSubmit} aria-labelledby="comment-form-heading">
            <textarea
              id="comment-content"
              aria-label="Komentaras"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={submitting}
              rows={4}
            />
            <div className="comment-form-footer">
              <span className={overLimit ? "comment-counter comment-counter-over" : "comment-counter"}>
                {trimmedLength} / {MAX_LENGTH}
              </span>
              <button type="submit" className="auth-button" disabled={submitting || trimmedLength === 0 || overLimit}>
                {submitting ? "Siunčiama..." : "Komentuoti"}
              </button>
            </div>
            {overLimit && <p className="auth-error" role="alert">Komentaras per ilgas. Sutrumpinkite iki 1000 simbolių.</p>}
            {submitError && <p className="auth-error" role="alert">{submitError}</p>}
          </form>
        ) : (
          <p>Norėdami komentuoti, <Link href="/login" className="auth-link">prisijunkite</Link>.</p>
        )}
      </div>
    </section>
  );
}
