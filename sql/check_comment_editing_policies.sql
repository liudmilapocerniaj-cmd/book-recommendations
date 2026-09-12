-- Read-only: verify migration 012 (sql/012_comment_editing.sql) landed correctly.

-- 1. edited_at column exists.
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'comments' and column_name = 'edited_at';

-- 2. RLS still enabled.
select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.comments'::regclass;

-- 3. Current comments UPDATE RLS policy. USING must include
-- "deleted_at IS NULL" -- that is what keeps an already-deleted comment
-- from ever being reachable by an UPDATE (editing or otherwise).
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'comments'
order by policyname;

-- 4. The old scrub trigger/function from migration 009 must be gone (it was
-- replaced, not stacked alongside a second one), and the new one must exist
-- and be enabled ('O').
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.comments'::regclass and not tgisinternal
order by tgname;

select exists (
  select 1 from pg_proc where proname = 'scrub_comment_on_delete'
) as old_scrub_function_still_exists;

select exists (
  select 1 from pg_proc where proname = 'handle_comment_update'
) as new_update_function_exists;

-- Expected: old_scrub_function_still_exists = false, new_update_function_exists = true,
-- and the trigger list above shows comments_handle_update (not comments_scrub_on_delete).

-- 5. Table-level privileges.
-- NOTE on UPDATE: has_table_privilege('UPDATE') reports true here because
-- Postgres treats holding UPDATE on ANY column as holding the table-level
-- privilege too -- it does NOT mean broad/unrestricted UPDATE. Section 6
-- below is the actual proof that only content and deleted_at are writable.
select has_table_privilege('authenticated', 'public.comments', 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.comments', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.comments', 'DELETE') as authenticated_can_hard_delete,
  has_table_privilege('authenticated', 'public.comments', 'UPDATE') as authenticated_has_some_update_privilege;

select has_table_privilege('anon', 'public.comments', 'SELECT') as anon_can_select,
  has_table_privilege('anon', 'public.comments', 'UPDATE') as anon_can_update,
  has_table_privilege('anon', 'public.comments', 'DELETE') as anon_can_delete;

-- 6. Column-level UPDATE privileges: only content and deleted_at should be true.
select has_column_privilege('authenticated', 'public.comments', 'content', 'UPDATE') as can_update_content,
  has_column_privilege('authenticated', 'public.comments', 'deleted_at', 'UPDATE') as can_update_deleted_at,
  has_column_privilege('authenticated', 'public.comments', 'edited_at', 'UPDATE') as can_update_edited_at,
  has_column_privilege('authenticated', 'public.comments', 'id', 'UPDATE') as can_update_id,
  has_column_privilege('authenticated', 'public.comments', 'user_id', 'UPDATE') as can_update_user_id,
  has_column_privilege('authenticated', 'public.comments', 'recommendation_id', 'UPDATE') as can_update_recommendation_id,
  has_column_privilege('authenticated', 'public.comments', 'parent_id', 'UPDATE') as can_update_parent_id,
  has_column_privilege('authenticated', 'public.comments', 'reply_to_comment_id', 'UPDATE') as can_update_reply_to_comment_id,
  has_column_privilege('authenticated', 'public.comments', 'thread_id', 'UPDATE') as can_update_thread_id,
  has_column_privilege('authenticated', 'public.comments', 'created_at', 'UPDATE') as can_update_created_at;

-- Expected: can_update_content = true, can_update_deleted_at = true; every
-- other column above (including edited_at) = false.
