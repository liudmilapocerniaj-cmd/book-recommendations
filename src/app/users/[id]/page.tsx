import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { GenreLabel } from "@/components/genre-label";
import { SaveRecommendationButton } from "@/components/save-recommendation-button";
import { supabase } from "@/lib/supabase";

type Recommendation = { id: string; book_title: string; book_author: string; description: string; cover_url: string | null; genre: string | null };

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return <main className="recommendations-page"><h1>Profilis nerastas.</h1><Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link></main>;
  }
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("display_name, bio").eq("id", id).maybeSingle();
  const name = profile?.display_name?.trim() || "Skaitytojas";
  const recommendations: Recommendation[] = [];
  let loadFailed = false;
  while (true) {
    const { data, error, count } = await supabase.from("recommendations")
      .select("id, book_title, book_author, description, cover_url, genre", { count: "exact" })
      .eq("user_id", id).order("id").range(recommendations.length, recommendations.length + 999);
    if (error) { loadFailed = true; break; }
    if (!data?.length) break;
    recommendations.push(...data);
    if (count !== null && recommendations.length >= count) break;
  }
  return (
    <main className="recommendations-page public-profile-page">
      <header className="homepage-header"><Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link></header>
      <header className="public-profile-header">
        <span className="profile-initial" aria-hidden="true">
          {Array.from(String(name).normalize("NFC"))[0]?.toLocaleUpperCase("lt")}
        </span>
        <div className="public-profile-summary">
          <h1>{name}</h1>
          {profileError && <p role="alert">Nepavyko įkelti profilio informacijos.</p>}
          {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
          {!loadFailed && <p className="profile-count">
            {recommendations.length} {new Intl.PluralRules("lt").select(recommendations.length) === "one"
              ? "rekomendacija"
              : new Intl.PluralRules("lt").select(recommendations.length) === "few"
                ? "rekomendacijos" : "rekomendacijų"}
          </p>}
        </div>
      </header>
      <h2 className="feed-title">Skaitytojo rekomendacijos</h2>
      {loadFailed ? <p role="alert">Nepavyko įkelti rekomendacijų.</p> : recommendations.length === 0 ? <p>Šis skaitytojas rekomendacijų kol kas nepaskelbė.</p> : recommendations.map((book) => (
        <article key={book.id} className="recommendation-card recommendation-with-cover">
          <BookCover url={book.cover_url} title={book.book_title} />
          <div className="recommendation-content">
            <h3 className="book-title"><Link className="recommendation-title-link" href={`/recommendations/${book.id}`}>{book.book_title}</Link></h3>
            <p className="book-author">{book.book_author}</p>
            <GenreLabel genre={book.genre} />
            <p className="book-description">{book.description}</p>
            <SaveRecommendationButton recommendationId={book.id} />
          </div>
        </article>
      ))}
    </main>
  );
}
