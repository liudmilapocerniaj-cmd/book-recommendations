import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { loadProfileNames } from "@/lib/public-profiles";
import { loadComments } from "@/lib/comments";
import { Recommender } from "@/components/recommender";
import { GenreLabel } from "@/components/genre-label";
import { SaveRecommendationButton } from "@/components/save-recommendation-button";
import { CommentsSection } from "@/components/comments-section";
import { CommentsHashScroll } from "@/components/comments-hash-scroll";

export const dynamic = "force-dynamic";

export default async function RecommendationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const { data: book, error } = await supabase.from("recommendations")
    .select("id, book_title, book_author, description, cover_url, created_at, user_id, genre")
    .eq("id", id).maybeSingle();

  if (error) {
    return (
      <main className="recommendations-page">
        <Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link>
        <h1>Rekomendacija</h1>
        <p role="alert">{uiErrorMessage(error, "Nepavyko įkelti rekomendacijos. Bandykite dar kartą.")}</p>
      </main>
    );
  }
  if (!book) notFound();
  const names = await loadProfileNames([book.user_id]);

  // The comments table may not exist yet if the migration hasn't been run; degrade
  // to an empty list rather than failing the whole recommendation page.
  const comments = await loadComments(book.id).catch(() => []);
  const commentNames = await loadProfileNames(comments.map((comment) => comment.user_id));

  const created = book.created_at ? new Date(book.created_at) : null;
  const date = created && !Number.isNaN(created.getTime()) ? created : null;

  return (
    <main className="recommendations-page">
      <header className="homepage-header">
        <Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link>
      </header>
      <article className="recommendation-card recommendation-with-cover recommendation-detail">
        <BookCover url={book.cover_url} title={book.book_title} />
        <div className="recommendation-content">
          <h1 className="book-title">{book.book_title}</h1>
          <p className="book-author">
            <Link href={`/authors/${encodeURIComponent(book.book_author)}`} className="auth-link">{book.book_author}</Link>
          </p>
          {date && <p className="book-author">Paskelbta: <time dateTime={date.toISOString()}>
            {new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Vilnius" }).format(date)}
          </time></p>}
          <p className="book-description">{book.description}</p>
          <GenreLabel genre={book.genre} />
          <Recommender userId={book.user_id} name={names[book.user_id]} />
          <SaveRecommendationButton recommendationId={book.id} />
        </div>
      </article>
      <CommentsSection recommendationId={book.id} initialComments={comments} initialNames={commentNames} />
      <CommentsHashScroll key={book.id} />
    </main>
  );
}
