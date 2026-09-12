-- Read-only: verify migration 011 (sql/011_notifications.sql) landed correctly.

-- 1. Table exists.
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'notifications'
) as notifications_table_exists;

-- 2. RLS enabled.
select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.notifications'::regclass;

-- 3. CHECK constraint on type, and the (comment_id, user_id) uniqueness guard.
select conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public' and rel.relname = 'notifications'
order by conname;

-- 4. Foreign keys, to confirm the ON DELETE actions match the spec:
-- user_id -> CASCADE, actor_user_id -> SET NULL, recommendation_id ->
-- CASCADE, comment_id -> SET NULL.
select conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public' and rel.relname = 'notifications' and con.contype = 'f'
order by conname;

-- 5. Indexes.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'notifications'
order by indexname;

-- 6. Trigger on public.comments that creates notifications, enabled ('O').
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.comments'::regclass and not tgisinternal;

-- 7. RLS policies on notifications. The UPDATE policy's qual (USING) must
-- include "read_at IS NULL" -- that is what makes only the NULL -> NOT NULL
-- transition possible; without it, an already-read row could be re-updated.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'notifications'
order by policyname;

-- 8. Table-level privileges.
-- authenticated: SELECT -> true (via RLS), INSERT -> false, DELETE -> false.
-- NOTE on UPDATE: has_table_privilege('UPDATE') reports true here because
-- Postgres treats holding UPDATE on ANY column as holding the table-level
-- privilege too -- it does NOT mean broad/unrestricted UPDATE. Section 9
-- below is the actual proof that only read_at is writable.
select has_table_privilege('authenticated', 'public.notifications', 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.notifications', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.notifications', 'DELETE') as authenticated_can_delete,
  has_table_privilege('authenticated', 'public.notifications', 'UPDATE') as authenticated_has_some_update_privilege;

-- anon: everything false.
select has_table_privilege('anon', 'public.notifications', 'SELECT') as anon_can_select,
  has_table_privilege('anon', 'public.notifications', 'INSERT') as anon_can_insert,
  has_table_privilege('anon', 'public.notifications', 'UPDATE') as anon_can_update,
  has_table_privilege('anon', 'public.notifications', 'DELETE') as anon_can_delete;

-- 9. Column-level UPDATE privileges: only read_at should be true. This is
-- the authoritative check that broad table UPDATE is NOT possible -- a
-- client can never include content/user_id/etc. in an UPDATE's SET list.
select has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE') as can_update_read_at,
  has_column_privilege('authenticated', 'public.notifications', 'user_id', 'UPDATE') as can_update_user_id,
  has_column_privilege('authenticated', 'public.notifications', 'actor_user_id', 'UPDATE') as can_update_actor_user_id,
  has_column_privilege('authenticated', 'public.notifications', 'recommendation_id', 'UPDATE') as can_update_recommendation_id,
  has_column_privilege('authenticated', 'public.notifications', 'comment_id', 'UPDATE') as can_update_comment_id,
  has_column_privilege('authenticated', 'public.notifications', 'type', 'UPDATE') as can_update_type,
  has_column_privilege('authenticated', 'public.notifications', 'created_at', 'UPDATE') as can_update_created_at,
  has_column_privilege('authenticated', 'public.notifications', 'id', 'UPDATE') as can_update_id;

-- Expected: only can_update_read_at is true; every other column above is false.

-- 10. EXECUTE on the SECURITY DEFINER trigger function must not be callable
-- directly by client roles (the trigger itself is invoked by the trigger
-- manager, not through this privilege, so revoking it does not break
-- comment/reply notifications).
select has_function_privilege('anon', 'public.create_comment_notifications()', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.create_comment_notifications()', 'EXECUTE') as authenticated_can_execute;

-- Expected: both false.
