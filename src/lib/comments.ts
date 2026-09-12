import { supabase } from "@/lib/supabase";

export type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export async function loadComments(recommendationId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, user_id, content, created_at")
    .eq("recommendation_id", recommendationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
