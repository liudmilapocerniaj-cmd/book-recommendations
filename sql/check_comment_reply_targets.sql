-- Read-only: verify migration 010 (sql/010_comment_reply_targets.sql) landed
-- correctly and did not weaken anything migration 009 already set up.

-- 1. reply_to_comment_id and thread_id columns exist, and thread_id is
-- NOT NULL (is_nullable = 'NO').
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'comments'
  and column_name in ('reply_to_comment_id', 'thread_id')
order by column_name;

-- Expected: reply_to_comment_id -> YES (nullable), thread_id -> NO (not null).

-- 2. Foreign keys on public.comments. thread_id must NOT appear here (it is
-- deliberately not a foreign key, so it survives a root row's physical
-- deletion); reply_to_comment_id and parent_id should both say
-- "ON DELETE SET NULL".
select conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public' and rel.relname = 'comments' and con.contype = 'f'
order by conname;

-- No table CHECK constraint should tie parent_id/reply_to_comment_id/
-- thread_id together (any such constraint would fight the FK "on delete set
-- null" actions -- see migration 010's notes). Expected: no rows, or only
-- unrelated CHECK constraints (e.g. the 1-1000 character content check from
-- migration 008).
select conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public' and rel.relname = 'comments' and con.contype = 'c'
order by conname;

-- 3. Trigger exists and is enabled ('O' = origin/enabled).
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.comments'::regclass and not tgisinternal;

-- 4. Backfill checks. All expected to return 0 immediately after running
-- migration 010 on the existing data.
select count(*) as top_level_rows_with_wrong_thread_id
from public.comments
where parent_id is null and thread_id <> id;

select count(*) as replies_missing_thread_id
from public.comments
where parent_id is not null and thread_id is null;

select count(*) as replies_missing_reply_target
from public.comments
where parent_id is not null and reply_to_comment_id is null;
-- NOTE: replies_missing_reply_target can legitimately become non-zero later
-- in normal operation -- it also matches a surviving reply whose exact
-- target was physically deleted (its author's account removed) after this
-- migration ran. thread_id, unlike reply_to_comment_id, is never expected
-- to go missing or wrong after this point, since it is not an FK.

-- 5. RLS is still enabled, and the policy list/definitions are unchanged
-- from migration 009 (public SELECT, own-row INSERT with deleted_at null,
-- own-row UPDATE requiring deleted_at not null -- no UPDATE/DELETE policy
-- with a wider reach).
select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.comments'::regclass;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'comments'
order by policyname;

-- 6. Column-level UPDATE privileges: only deleted_at should be true.
select has_column_privilege('authenticated', 'public.comments', 'deleted_at', 'UPDATE') as can_update_deleted_at,
  has_column_privilege('authenticated', 'public.comments', 'content', 'UPDATE') as can_update_content,
  has_column_privilege('authenticated', 'public.comments', 'parent_id', 'UPDATE') as can_update_parent_id,
  has_column_privilege('authenticated', 'public.comments', 'reply_to_comment_id', 'UPDATE') as can_update_reply_to_comment_id,
  has_column_privilege('authenticated', 'public.comments', 'thread_id', 'UPDATE') as can_update_thread_id,
  has_column_privilege('authenticated', 'public.comments', 'user_id', 'UPDATE') as can_update_user_id,
  has_column_privilege('authenticated', 'public.comments', 'recommendation_id', 'UPDATE') as can_update_recommendation_id,
  has_column_privilege('authenticated', 'public.comments', 'created_at', 'UPDATE') as can_update_created_at,
  has_column_privilege('authenticated', 'public.comments', 'id', 'UPDATE') as can_update_id;

-- Expected: only can_update_deleted_at is true; every other column above is false.

-- 7. Hard DELETE must remain impossible for both roles.
select has_table_privilege('authenticated', 'public.comments', 'DELETE') as authenticated_can_hard_delete,
  has_table_privilege('anon', 'public.comments', 'DELETE') as anon_can_hard_delete;

-- 8. anon should still be read-only.
select has_table_privilege('anon', 'public.comments', 'SELECT') as anon_can_select,
  has_table_privilege('anon', 'public.comments', 'INSERT') as anon_can_insert,
  has_table_privilege('anon', 'public.comments', 'UPDATE') as anon_can_update;
