import Link from "next/link";

export function Recommender({ userId, name }: { userId: string; name?: string }) {
  return <p className="book-author recommender">Rekomenduoja: <Link className="auth-link" href={`/users/${userId}`}>{name || "Skaitytojas"}</Link></p>;
}
