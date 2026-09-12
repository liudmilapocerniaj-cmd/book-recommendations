-- Read-only: inspect RLS and policies on comments.
select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.comments'::regclass;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'comments';

select has_table_privilege('authenticated', 'public.comments', 'SELECT')
  as authenticated_can_select,
  has_table_privilege('authenticated', 'public.comments', 'INSERT')
  as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.comments', 'DELETE')
  as authenticated_can_delete,
  has_table_privilege('authenticated', 'public.comments', 'UPDATE')
  as authenticated_can_update;

select has_table_privilege('anon', 'public.comments', 'SELECT')
  as anon_can_select,
  has_table_privilege('anon', 'public.comments', 'INSERT')
  as anon_can_insert;
