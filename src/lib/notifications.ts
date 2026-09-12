import { supabase } from "@/lib/supabase";

export type NotificationType = "recommendation_comment" | "comment_reply";

export type Notification = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  recommendation_id: string;
  comment_id: string | null;
  type: NotificationType;
  created_at: string;
  read_at: string | null;
};

export async function loadNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, actor_user_id, recommendation_id, comment_id, type, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function loadRecommendationTitles(ids: string[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const titles: Record<string, string> = {};
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const { data, error } = await supabase
      .from("recommendations")
      .select("id, book_title")
      .in("id", uniqueIds.slice(offset, offset + 100));
    if (error) continue;
    for (const row of data ?? []) titles[row.id] = row.book_title;
  }
  return titles;
}

const NOTIFICATIONS_READ_EVENT = "notifications:read";

// A tiny same-tab broadcast so the header's unread badge (NotificationsNavLink)
// can refetch its count after another part of the app (the /notifications
// page) marks something read -- without a full reload, a global state
// library, or a realtime subscription.
export function notifyNotificationsRead() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
  }
}

export function onNotificationsRead(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFICATIONS_READ_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, handler);
}
