import { supabase } from "@/lib/supabase";

type Recommendation = { id: string; user_id: string; book_title: string; book_author: string; description: string; cover_url: string | null; genre: string | null };

export async function loadGenreRecommendations(genre?: string): Promise<Recommendation[]> {
  const rows: Recommendation[] = [];
  while (true) {
    let query = supabase.from("recommendations")
      .select("id, user_id, book_title, book_author, description, cover_url, genre", { count: "exact" })
      .not("genre", "is", null).order("id").range(rows.length, rows.length + 999);
    if (genre !== undefined) query = query.eq("genre", genre);
    const { data, error, count } = await query;
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    if (count !== null && rows.length >= count) return rows;
  }
}
