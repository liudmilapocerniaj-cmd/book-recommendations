import Link from "next/link";
import type { ReactNode } from "react";

export function Recommender({ userId, name, children }: { userId: string; name?: string; children?: ReactNode }) {
  return <p className="book-author recommender">Rekomenduoja: <Link className="auth-link" href={`/users/${userId}`}>{name || "Skaitytojas"}</Link>{children}</p>;
}
