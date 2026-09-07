import Link from "next/link";

export default function RecommendationNotFound() {
  return (
    <main className="recommendations-page">
      <h1>Rekomendacija nerasta.</h1>
      <Link href="/" className="auth-link">← Grįžti į rekomendacijas</Link>
    </main>
  );
}
