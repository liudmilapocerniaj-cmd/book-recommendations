-- Creates a new table for the "Noriu perskaityti" (reading list) feature.
-- This does not change the recommendations, profiles, or auth schema,
-- and does not touch any existing table or policy.
begin;

create table public.saved_recommendations (
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recommendation_id)
);

-- Speeds up the cascade delete lookup when a recommendation is removed,
-- and any future query that looks up savers by recommendation.
create index saved_recommendations_recommendation_id_idx
  on public.saved_recommendations (recommendation_id);

alter table public.saved_recommendations enable row level security;

revoke all on public.saved_recommendations from anon, authenticated;
grant select, insert, delete on public.saved_recommendations to authenticated;

create policy "Users can view their own saved recommendations"
on public.saved_recommendations for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can save recommendations for themselves"
on public.saved_recommendations for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can remove their own saved recommendations"
on public.saved_recommendations for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
