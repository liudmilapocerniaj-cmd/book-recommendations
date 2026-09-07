import Link from "next/link";
import { genres } from "@/lib/genres";
import { loadGenreRecommendations } from "@/lib/genre-recommendations";

export const dynamic = "force-dynamic";

export default async function GenresPage() {
  let available: string[] = [];
  let failed = false;
  try {
    const rows = await loadGenreRecommendations();
    available = genres.filter((genre) => rows.some((book) => book.genre === genre));
  } catch { failed = true; }
  return <main className="recommendations-page genres-page">
    <header className="homepage-header"><Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link></header>
    <h1>Žanrai</h1>
    {failed ? <p role="alert">Nepavyko įkelti žanrų. Bandykite dar kartą.</p> : available.length === 0 ? <p>Rekomendacijų su nurodytu žanru kol kas nėra.</p> : (
      <section aria-label="Pasirinkite žanrą">
        <ul className="genre-grid">{available.map((genre) => <li key={genre}><Link className="genre-card" href={`/genres/${encodeURIComponent(genre)}`}>{genre}</Link></li>)}</ul>
      </section>
    )}
  </main>;
}
