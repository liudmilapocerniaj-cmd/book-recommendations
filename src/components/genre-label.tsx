import Link from "next/link";

export function GenreLabel({ genre }: { genre?: string | null }) {
  return genre ? <p className="genre-label"><Link href={`/genres/${encodeURIComponent(genre)}`}>{genre}</Link></p> : null;
}
