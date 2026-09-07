-- Read-only: inspect RLS, existing policies, and INSERT privileges.
select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.recommendations'::regclass;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'recommendations';

select has_table_privilege('authenticated', 'public.recommendations', 'INSERT')
  as authenticated_can_insert;

select has_table_privilege('authenticated', 'public.recommendations', 'UPDATE')
  as authenticated_can_update,
  has_table_privilege('authenticated', 'public.recommendations', 'DELETE')
  as authenticated_can_delete;
