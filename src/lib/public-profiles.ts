import { supabase } from "@/lib/supabase";

export async function loadProfileNames(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const names: Record<string, string> = {};
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase.from("profiles")
      .select("id, display_name").in("id", ids.slice(offset, offset + 100));
    // Recommendations remain readable while the profile migration is pending.
    if (error) continue;
    for (const profile of data ?? []) names[profile.id] = profile.display_name?.trim() || "Skaitytojas";
  }
  return names;
}
