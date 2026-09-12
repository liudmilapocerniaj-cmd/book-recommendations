-- Creates a new table for the recommendation comments feature.
-- This does not change the recommendations, profiles, or auth schema,
-- and does not touch any existing table or policy.
begin;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Supports "all comments for a recommendation, oldest first" (the page's only
-- read query) with a single index; recommendation_id alone is its leftmost prefix.
create index comments_recommendation_id_created_at_idx
  on public.comments (recommendation_id, created_at);

alter table public.comments enable row level security;

revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

create policy "Comments are readable by everyone"
on public.comments for select to anon, authenticated using (true);

create policy "Users can create their own comments"
on public.comments for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own comments"
on public.comments for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
