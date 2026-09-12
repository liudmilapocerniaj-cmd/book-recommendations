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
  edited_at: string | null;
};

export async function loadComments(recommendationId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, user_id, content, created_at, parent_id, deleted_at, reply_to_comment_id, thread_id, edited_at")
    .eq("recommendation_id", recommendationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

const COMMENT_COUNT_ID_BATCH_SIZE = 100;
const COMMENT_COUNT_PAGE_SIZE = 1000;

export async function loadCommentCounts(recommendationIds: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(recommendationIds.filter(Boolean))];
  const counts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));

  for (let start = 0; start < ids.length; start += COMMENT_COUNT_ID_BATCH_SIZE) {
    const batch = ids.slice(start, start + COMMENT_COUNT_ID_BATCH_SIZE);
    let offset = 0;
    // Read every page, even when the API caps responses below our requested size.
    while (true) {
      const { data, error, count } = await supabase.from("comments")
        .select("recommendation_id", { count: "exact" })
        .in("recommendation_id", batch)
        .is("deleted_at", null)
        .order("id")
        .range(offset, offset + COMMENT_COUNT_PAGE_SIZE - 1);
      if (error) throw error;
      if (!data?.length) break;
      for (const comment of data) counts[comment.recommendation_id] += 1;
      offset += data.length;
      if (count !== null && offset >= count) break;
    }
  }

  return counts;
}
