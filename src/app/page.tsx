import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { RecommendationSearch } from "@/components/recommendation-search";
import { loadProfileNames } from "@/lib/public-profiles";
import { SiteHeaderNav } from "@/components/site-header-nav";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*");
  const profileNames = await loadProfileNames((data ?? []).map((book) => book.user_id));

  return (
    <main className="recommendations-page discovery-page">
      <header className="homepage-header discovery-header">
        <Link href="/" className="site-brand">Knygų rekomendacijos<span>Skaitytojas skaitytojui</span></Link>
        <SiteHeaderNav recommendationIds={(data ?? []).map((book) => book.id)} />
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
      <ScrollToTopButton />
    </main>
  );
}
