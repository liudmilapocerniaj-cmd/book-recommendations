import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { loadAuthorRecommendations } from "@/lib/author-recommendations";
import { loadProfileNames } from "@/lib/public-profiles";
import { Recommender } from "@/components/recommender";

export default async function AuthorPage({ params }: { params: Promise<{ author: string }> }) {
  const { author: encodedAuthor } = await params;
  let author = encodedAuthor;
  try {
    author = decodeURIComponent(encodedAuthor);
  } catch {
    // Preserve names containing a literal percent sign or malformed escapes.
  }
  let recommendations;
  try {
    recommendations = await loadAuthorRecommendations(author);
  } catch {
    return <main className="recommendations-page"><Link href="/authors" className="auth-link">← Visi autoriai</Link><h1>{author}</h1><p role="alert">Nepavyko įkelti rekomendacijų. Bandykite dar kartą.</p></main>;
  }
  const names = await loadProfileNames(recommendations.map((book) => book.user_id));
  return (
    <main className="recommendations-page">
      <header className="homepage-header"><Link href="/authors" className="auth-link">← Visi autoriai</Link></header>
      <h1>{author}</h1>
      {recommendations.length === 0 ? <p>Šio autoriaus rekomendacijų kol kas nėra.</p> : recommendations.map((book) => (
        <div key={book.id} className="recommendation-card recommendation-with-cover">
          <BookCover url={book.cover_url} title={book.book_title} />
          <div className="recommendation-content">
            <h2 className="book-title">{book.book_title}</h2>
            <p className="book-author">{book.book_author}</p>
            <p className="book-description">{book.description}</p>
            <Recommender userId={book.user_id} name={names[book.user_id]} />
          </div>
        </div>
      ))}
    </main>
  );
}
