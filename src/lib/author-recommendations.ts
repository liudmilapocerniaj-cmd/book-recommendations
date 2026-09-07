import { supabase } from "@/lib/supabase";

type Recommendation = {
  id: string;
  user_id: string;
  book_author: string;
  book_title: string;
  description: string;
  cover_url: string | null;
};

export async function loadAuthorRecommendations(author?: string): Promise<Recommendation[]> {
  const rows: Recommendation[] = [];
  // Read in batches to include records beyond Supabase's response-size limit.
  while (true) {
    let query = supabase.from("recommendations")
      .select("id, user_id, book_author, book_title, description, cover_url", { count: "exact" })
      .order("id").range(rows.length, rows.length + 999);
    if (author !== undefined) query = query.eq("book_author", author);
    const { data, error, count } = await query;
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    if (count !== null && rows.length >= count) return rows;
  }
}
