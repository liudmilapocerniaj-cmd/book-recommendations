import Link from "next/link";
import { authorInitial, authorLetters, uniqueAuthors } from "@/lib/authors";
import { loadAuthorRecommendations } from "@/lib/author-recommendations";

export default async function AuthorsPage() {
  let authors: string[];
  try {
    authors = uniqueAuthors(await loadAuthorRecommendations());
  } catch {
    return <main className="recommendations-page"><Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link><h1>Autoriai A–Ž</h1><p role="alert">Nepavyko įkelti autorių. Bandykite dar kartą.</p></main>;
  }
  const groups = [...authorLetters, "Kiti"].map((letter) => ({
    letter,
    names: authors.filter((name) => authorInitial(name) === letter),
  }));

  return (
    <main className="recommendations-page authors-page">
      <header className="homepage-header authors-header"><Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link></header>
      <h1>Autoriai A–Ž</h1>
      <p>Pasirinkite autorių</p>
      <nav className="author-alphabet" aria-label="Autoriai pagal pirmąją raidę">
        {groups.map(({ letter, names }) => names.length ? (
          <a key={letter} href={`#letter-${letter}`} aria-label={`Autoriai: ${letter}`}>{letter}</a>
        ) : letter !== "Kiti" ? <span key={letter} aria-disabled="true">{letter}</span> : null)}
      </nav>
      {authors.length === 0 && <p>Autorių kol kas nėra.</p>}
      {groups.filter((group) => group.names.length).map(({ letter, names }) => (
        <section key={letter} className="recommendation-card author-group" aria-labelledby={`letter-${letter}`}>
          <h2 id={`letter-${letter}`}>{letter}</h2>
          <ul>
            {names.map((name) => <li key={name}><Link className="auth-link" href={`/authors/${encodeURIComponent(name)}`}>{name}</Link></li>)}
          </ul>
        </section>
      ))}
    </main>
  );
}
