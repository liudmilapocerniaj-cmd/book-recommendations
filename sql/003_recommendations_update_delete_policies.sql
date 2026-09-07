-- Permission change: run only after reviewing the read-only policy check.
begin;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recommendations'
      and cmd in ('UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'Existing UPDATE, DELETE or ALL policy found. Review before changing permissions.';
  end if;
end
$$;

alter table public.recommendations enable row level security;
grant update, delete on public.recommendations to authenticated;

create policy "Users can update their own recommendations"
on public.recommendations for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own recommendations"
on public.recommendations for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
