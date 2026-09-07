import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Recommender } from "@/components/recommender";
import { GenreLabel } from "@/components/genre-label";
import { decodeGenre } from "@/lib/genres";
import { loadGenreRecommendations } from "@/lib/genre-recommendations";
import { loadProfileNames } from "@/lib/public-profiles";

export const dynamic = "force-dynamic";

export default async function GenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const genre = decodeGenre((await params).genre);
  let books;
  try { books = await loadGenreRecommendations(genre); } catch {
    return <main className="recommendations-page"><Link href="/genres" className="auth-link">← Visi žanrai</Link><h1>{genre}</h1><p role="alert">Nepavyko įkelti rekomendacijų. Bandykite dar kartą.</p></main>;
  }
  const names = await loadProfileNames(books.map((book) => book.user_id));
  return <main className="recommendations-page">
    <header className="homepage-header"><Link href="/genres" className="auth-link">← Visi žanrai</Link></header>
    <h1>{genre}</h1>
    {books.length === 0 ? <p>Šio žanro rekomendacijų kol kas nėra.</p> : books.map((book) => (
      <article key={book.id} className="recommendation-card recommendation-with-cover">
        <BookCover url={book.cover_url} title={book.book_title} />
        <div className="recommendation-content">
          <h2 className="book-title"><Link href={`/recommendations/${book.id}`} className="recommendation-title-link">{book.book_title}</Link></h2>
          <p className="book-author">{book.book_author}</p>
          <GenreLabel genre={book.genre} />
          <p className="book-description">{book.description}</p>
          <Recommender userId={book.user_id} name={names[book.user_id]} />
        </div>
      </article>
    ))}
  </main>;
}
