-- Read-only: inspect RLS, policies, and column-level grants after adding
-- one-level replies + soft delete to public.comments (sql/009_comment_replies.sql).

select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.comments'::regclass;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'comments';

-- Table-level privileges. Note: has_table_privilege('UPDATE') reports true if
-- the role has UPDATE on ANY column, so it will read true here because of the
-- deleted_at column grant below -- it does NOT mean unrestricted UPDATE.
select has_table_privilege('authenticated', 'public.comments', 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.comments', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.comments', 'DELETE') as authenticated_can_hard_delete,
  has_table_privilege('authenticated', 'public.comments', 'UPDATE') as authenticated_has_some_update_privilege;

-- Column-level check: confirms UPDATE is possible on deleted_at only.
select has_column_privilege('authenticated', 'public.comments', 'deleted_at', 'UPDATE') as can_update_deleted_at,
  has_column_privilege('authenticated', 'public.comments', 'content', 'UPDATE') as can_update_content,
  has_column_privilege('authenticated', 'public.comments', 'user_id', 'UPDATE') as can_update_user_id,
  has_column_privilege('authenticated', 'public.comments', 'recommendation_id', 'UPDATE') as can_update_recommendation_id,
  has_column_privilege('authenticated', 'public.comments', 'parent_id', 'UPDATE') as can_update_parent_id,
  has_column_privilege('authenticated', 'public.comments', 'created_at', 'UPDATE') as can_update_created_at,
  has_column_privilege('authenticated', 'public.comments', 'id', 'UPDATE') as can_update_id;

-- Expected: only can_update_deleted_at is true above; all others false.

select has_table_privilege('anon', 'public.comments', 'SELECT') as anon_can_select,
  has_table_privilege('anon', 'public.comments', 'INSERT') as anon_can_insert,
  has_table_privilege('anon', 'public.comments', 'UPDATE') as anon_can_update,
  has_table_privilege('anon', 'public.comments', 'DELETE') as anon_can_delete;

-- Trigger enforcing the one-level reply rule.
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.comments'::regclass and not tgisinternal;
