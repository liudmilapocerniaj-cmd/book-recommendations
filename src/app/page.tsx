import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { RecommendationSearch } from "@/components/recommendation-search";
import { loadProfileNames } from "@/lib/public-profiles";

export default async function Home() {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*");
  const profileNames = await loadProfileNames((data ?? []).map((book) => book.user_id));

  return (
    <main className="recommendations-page discovery-page">
      <header className="homepage-header discovery-header">
        <Link href="/" className="site-brand">Knygų rekomendacijos<span>Skaitytojas skaitytojui</span></Link>
        <nav aria-label="Pagrindinė navigacija">
          <Link href="/" className="nav-link" aria-current="page">Atrasti</Link>
          <Link href="/authors" className="nav-link">Autoriai</Link>
          <Link href="/genres" className="nav-link">Žanrai</Link>
          <Link href="/my-recommendations" className="nav-link">
            Mano rekomendacijos
          </Link>
          <Link href="/recommendations/new" className="nav-link nav-recommend">
            + Rekomenduoti
          </Link>
          <Link href="/login" className="nav-link">
            Mano paskyra
          </Link>
        </nav>
      </header>
      <section className="discovery-hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Atrask kitą knygą, kurios pats nebūtum pasirinkęs.</h1>
        <p>Tikros skaitytojų rekomendacijos ir priežastys, kodėl verta skaityti.</p>
        <Link href="/recommendations/new" className="hero-cta">+ Rekomenduoti knygą</Link>
      </section>

      <section className="recommendation-feed" aria-labelledby="feed-title">
        <h2 id="feed-title" className="feed-title">Atraskite knygas</h2>
        {error ? <p>{uiErrorMessage(error, "Nepavyko įkelti rekomendacijų. Bandykite dar kartą.")}</p> : (
          <RecommendationSearch recommendations={data} profileNames={profileNames} />
        )}
      </section>
    </main>
  );
}
