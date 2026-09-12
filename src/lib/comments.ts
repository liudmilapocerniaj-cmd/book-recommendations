import { supabase } from "@/lib/supabase";

export type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  deleted_at: string | null;
  reply_to_comment_id: string | null;
  thread_id: string;
};

export async function loadComments(recommendationId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, user_id, content, created_at, parent_id, deleted_at, reply_to_comment_id, thread_id")
    .eq("recommendation_id", recommendationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
