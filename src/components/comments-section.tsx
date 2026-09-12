"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { loadProfileNames } from "@/lib/public-profiles";
import { uiErrorMessage } from "@/lib/ui-error-message";
import type { Comment } from "@/lib/comments";

const MAX_LENGTH = 1000;
const COLLAPSED_REPLY_LIMIT = 3;

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

type ReplyTarget = {
  threadId: string;
  targetId: string;
  authorName: string;
};

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
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(new Set());
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);
  const editSubmittingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (replyTarget) textareaRef.current?.focus();
  }, [replyTarget]);

  const showForm = hasMounted && ready && Boolean(userId);
  const trimmedLength = content.trim().length;
  const overLimit = trimmedLength > MAX_LENGTH;
  const editTrimmedLength = editContent.trim().length;
  const editOverLimit = editTrimmedLength > MAX_LENGTH;

  // Comments are grouped by thread_id, not by "parent_id is null": parent_id
  // can become null for a surviving reply once its thread's root row is
  // physically deleted (its own "on delete set null" FK), but thread_id is
  // a plain, non-FK value that survives that deletion untouched. Within a
  // thread, the root (if its row still exists) is the item whose id equals
  // the thread_id; everything else is a reply, flattened to one level.
  // Comments load in created_at-ascending order and are appended in that
  // same order, so each thread's items stay oldest -> newest for free.
  const { threadOrder, threadsById } = useMemo(() => {
    const order: string[] = [];
    const byId = new Map<string, Comment[]>();
    for (const comment of comments) {
      if (!byId.has(comment.thread_id)) {
        byId.set(comment.thread_id, []);
        order.push(comment.thread_id);
      }
      byId.get(comment.thread_id)!.push(comment);
    }
    return { threadOrder: order, threadsById: byId };
  }, [comments]);

  const visibleCommentCount = threadOrder.reduce((count, threadId) => {
    const items = threadsById.get(threadId) ?? [];
    const root = items.find((item) => item.id === item.thread_id);
    const rootCount = root && root.deleted_at === null ? 1 : 0;
    const replyCount = items.filter((item) => item.id !== item.thread_id && item.deleted_at === null).length;
    return count + rootCount + replyCount;
  }, 0);

  function startReply(comment: Comment) {
    setReplyTarget({ threadId: comment.thread_id, targetId: comment.id, authorName: names[comment.user_id] || "Skaitytojas" });
  }

  function toggleThreadExpanded(threadId: string) {
    setExpandedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }

  // A reply's label names whoever it actually replies to (root or another
  // reply in the same flat thread), not always the thread's root author.
  // reply_to_comment_id can be null even though parent_id is not: its "on
  // delete set null" FK clears it if the target comment is later physically
  // removed (e.g. the target's author deletes their account). That is a
  // normal, permanent state for a surviving reply, not a data error.
  function replyLabelFor(reply: Comment) {
    if (reply.reply_to_comment_id === null) return "Atsakymas į pašalintą komentarą";
    const target = comments.find((candidate) => candidate.id === reply.reply_to_comment_id);
    if (!target || target.deleted_at !== null) return "Atsakymas į pašalintą komentarą";
    return `Atsakymas: ${names[target.user_id] || "Skaitytojas"}`;
  }

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
        .insert({
          recommendation_id: recommendationId,
          user_id: userId,
          content: trimmed,
          // The server derives the authoritative parent_id/thread_id itself
          // (see comments_enforce_reply_rules); these are just best-effort
          // hints for a top-level comment (both null) vs a reply.
          parent_id: replyTarget?.threadId ?? null,
          reply_to_comment_id: replyTarget?.targetId ?? null,
        })
        .select("id, user_id, content, created_at, parent_id, deleted_at, reply_to_comment_id, thread_id, edited_at")
        .single();
      if (error) throw error;
      setComments((rows) => [...rows, data]);
      // Make sure a newly posted reply is never immediately hidden behind
      // "Rodyti dar ... atsakymus" in its own thread.
      setExpandedThreadIds((prev) => new Set(prev).add(data.thread_id));
      setContent("");
      setReplyTarget(null);
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
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", comment.id)
        .eq("user_id", userId)
        .select("id, deleted_at")
        .single();
      if (error) throw error;
      setComments((rows) => rows.map((row) => (row.id === comment.id ? { ...row, deleted_at: data.deleted_at } : row)));
    } catch (error) {
      setDeleteError(uiErrorMessage(error, "Nepavyko ištrinti komentaro. Bandykite dar kartą."));
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent("");
    setEditError("");
  }

  async function handleSaveEdit(comment: Comment) {
    if (editSubmittingRef.current || !userId) return;
    const trimmed = editContent.trim();
    if (!trimmed) {
      setEditError("Įveskite komentarą.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setEditError("Komentaras per ilgas. Sutrumpinkite iki 1000 simbolių.");
      return;
    }
    editSubmittingRef.current = true;
    setEditSubmitting(true);
    setEditError("");
    try {
      const { data, error } = await supabase
        .from("comments")
        .update({ content: trimmed })
        .eq("id", comment.id)
        .eq("user_id", userId)
        .select("id, content, edited_at")
        .single();
      if (error) throw error;
      setComments((rows) =>
        rows.map((row) => (row.id === comment.id ? { ...row, content: data.content, edited_at: data.edited_at } : row))
      );
      setEditingId(null);
      setEditContent("");
    } catch (error) {
      setEditError(uiErrorMessage(error, "Nepavyko išsaugoti pakeitimų. Bandykite dar kartą."));
    } finally {
      editSubmittingRef.current = false;
      setEditSubmitting(false);
    }
  }

  // Shared rendering for a root comment and for each reply: author, an
  // optional reply-target label, the content (or an inline editor when this
  // comment is the one being edited), the date + "Redaguota", and the
  // Atsakyti/Redaguoti/Ištrinti action row. Editing never rebuilds the row --
  // it is always a plain UPDATE on this same comment, so its id, parent_id,
  // reply_to_comment_id, and thread_id (and therefore its position and
  // reply-target label) never change.
  function renderCommentBody(comment: Comment, replyLabel?: string) {
    const isOwn = hasMounted && userId === comment.user_id;
    const isEditing = editingId === comment.id;

    return (
      <>
        <p className="comment-author">{names[comment.user_id] || "Skaitytojas"}</p>
        {replyLabel && <p className="comment-reply-label">{replyLabel}</p>}
        {isEditing ? (
          <div className="comment-edit">
            <textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              disabled={editSubmitting}
              rows={4}
              aria-label="Redaguoti komentarą"
            />
            <div className="comment-form-footer">
              <span className={editOverLimit ? "comment-counter comment-counter-over" : "comment-counter"}>
                {editTrimmedLength} / {MAX_LENGTH}
              </span>
              <div className="comment-edit-buttons">
                <button
                  type="button"
                  className="auth-button"
                  disabled={editSubmitting || editTrimmedLength === 0 || editOverLimit}
                  onClick={() => void handleSaveEdit(comment)}
                >
                  {editSubmitting ? "Saugoma…" : "Išsaugoti"}
                </button>
                <button type="button" className="auth-link" disabled={editSubmitting} onClick={cancelEdit}>
                  Atšaukti
                </button>
              </div>
            </div>
            {editOverLimit && <p className="auth-error" role="alert">Komentaras per ilgas. Sutrumpinkite iki 1000 simbolių.</p>}
            {editError && <p className="auth-error" role="alert">{editError}</p>}
          </div>
        ) : (
          <p className="comment-content">{comment.content}</p>
        )}
        <div className="comment-meta">
          <time dateTime={comment.created_at}>{formatCommentDate(comment.created_at)}</time>
          {comment.edited_at !== null && <span className="comment-edited-label"> · Redaguota</span>}
        </div>
        {!isEditing && (showForm || isOwn) && (
          <div className="comment-actions">
            {showForm && (
              <button type="button" className="auth-link comment-reply" onClick={() => startReply(comment)}>
                Atsakyti
              </button>
            )}
            {isOwn && (
              <button type="button" className="auth-link comment-edit-trigger" onClick={() => startEdit(comment)}>
                Redaguoti
              </button>
            )}
            {isOwn && (
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
        )}
      </>
    );
  }

  return (
    <section className="comments-section" aria-labelledby="comments-heading">
      <h2 id="comments-heading">Komentarai ({visibleCommentCount})</h2>

      {visibleCommentCount === 0 ? (
        <p className="comments-empty">Komentarų dar nėra. Būkite pirmas, kuris pasidalins mintimis.</p>
      ) : (
        <ul className="comments-list">
          {threadOrder.map((threadId) => {
            const items = threadsById.get(threadId) ?? [];
            // The root is the item whose id equals the thread's id. It may
            // be absent entirely: physically deleted because its author's
            // account was removed (thread_id survives that deletion; the
            // row itself does not).
            const root = items.find((item) => item.id === item.thread_id) ?? null;
            const visibleReplies = items.filter((item) => item.id !== item.thread_id && item.deleted_at === null);
            if ((!root || root.deleted_at !== null) && visibleReplies.length === 0) return null;

            // A reply currently being edited must never be hidden by a
            // collapse: if it sits beyond the collapsed slice, treat this
            // thread as expanded regardless of expandedThreadIds, so the
            // open edit form (and its unsaved text) never disappears.
            const editingReplyIndex = visibleReplies.findIndex((reply) => reply.id === editingId);
            const hasHiddenEditingReply = editingReplyIndex >= COLLAPSED_REPLY_LIMIT;
            const isExpanded = expandedThreadIds.has(threadId) || hasHiddenEditingReply;
            const hasMoreThanLimit = visibleReplies.length > COLLAPSED_REPLY_LIMIT;
            const displayedReplies = isExpanded ? visibleReplies : visibleReplies.slice(0, COLLAPSED_REPLY_LIMIT);
            const hiddenReplyCount = visibleReplies.length - COLLAPSED_REPLY_LIMIT;

            return (
              <li key={threadId} className="comment-item">
                {root && root.deleted_at === null ? (
                  renderCommentBody(root)
                ) : (
                  <p className="comment-deleted-placeholder">Komentaras pašalintas.</p>
                )}

                {visibleReplies.length > 0 && (
                  <ul className="comment-replies">
                    {displayedReplies.map((reply) => (
                      <li key={reply.id} className="comment-item comment-reply-item">
                        {renderCommentBody(reply, replyLabelFor(reply))}
                      </li>
                    ))}
                    {hasMoreThanLimit && (
                      <li className="comment-toggle-replies-item">
                        <button
                          type="button"
                          className="comment-toggle-replies"
                          aria-expanded={isExpanded}
                          onClick={() => toggleThreadExpanded(threadId)}
                        >
                          {isExpanded ? "Rodyti mažiau" : `Rodyti dar ${hiddenReplyCount} atsakymų`}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {deleteError && <p className="auth-error" role="alert">{deleteError}</p>}

      <div className="comment-form-wrapper">
        <h3 id="comment-form-heading">Parašyti komentarą</h3>
        {showForm ? (
          <form className="comment-form" onSubmit={handleSubmit} aria-labelledby="comment-form-heading">
            {replyTarget && (
              <div className="comment-reply-target">
                <span>Atsakote: {replyTarget.authorName}</span>
                <button type="button" className="auth-link" onClick={() => setReplyTarget(null)}>
                  Atšaukti
                </button>
              </div>
            )}
            <textarea
              id="comment-content"
              ref={textareaRef}
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
