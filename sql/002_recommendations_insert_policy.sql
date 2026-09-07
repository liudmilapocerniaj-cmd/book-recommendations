-- Run the read-only policy check first. This script changes permissions only.
-- Stop for review if any INSERT or ALL policy already exists.
begin;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recommendations'
      and cmd in ('INSERT', 'ALL')
  ) then
    raise exception 'An INSERT or ALL policy already exists. Review existing policies before making changes.';
  end if;
end
$$;

alter table public.recommendations enable row level security;
grant insert on table public.recommendations to authenticated;

create policy "Users can insert their own recommendations"
on public.recommendations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

commit;
