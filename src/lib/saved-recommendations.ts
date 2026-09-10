import { supabase } from "@/lib/supabase";

export type SavedRecommendation = {
  id: string;
  user_id: string;
  book_title: string;
  book_author: string;
  description: string;
  cover_url: string | null;
  genre: string | null;
};

export async function loadSavedRecommendations(userId: string): Promise<SavedRecommendation[]> {
  const { data: saved, error: savedError } = await supabase
    .from("saved_recommendations")
    .select("recommendation_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (savedError) throw savedError;

  const ids = (saved ?? []).map((row) => row.recommendation_id);
  if (ids.length === 0) return [];

  const books = new Map<string, SavedRecommendation>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase
      .from("recommendations")
      .select("id, user_id, book_title, book_author, description, cover_url, genre")
      .in("id", ids.slice(offset, offset + 100));
    if (error) throw error;
    for (const book of data ?? []) books.set(book.id, book);
  }

  // A saved row can only outlive its recommendation for the instant between the
  // recommendation delete and the FK cascade removing this row; skip it if seen.
  return ids.map((id) => books.get(id)).filter((book): book is SavedRecommendation => Boolean(book));
}
