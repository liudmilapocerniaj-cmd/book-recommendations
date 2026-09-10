-- Read-only: inspect RLS and policies on saved_recommendations.
select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.saved_recommendations'::regclass;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'saved_recommendations';

select has_table_privilege('authenticated', 'public.saved_recommendations', 'SELECT')
  as authenticated_can_select,
  has_table_privilege('authenticated', 'public.saved_recommendations', 'INSERT')
  as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.saved_recommendations', 'DELETE')
  as authenticated_can_delete;

select has_table_privilege('anon', 'public.saved_recommendations', 'SELECT')
  as anon_can_select;
