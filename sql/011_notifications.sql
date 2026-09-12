-- Adds a private in-app notifications system. Does not touch recommendations,
-- profiles, saved_recommendations, or comments schema/data -- it only reads
-- from recommendations and comments (via SELECT, which RLS already grants
-- broadly on both) and adds one new table plus one new trigger on comments.
-- Does not modify migrations 008, 009, or 010.
begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  comment_id uuid null references public.comments(id) on delete set null,
  type text not null check (type in ('recommendation_comment', 'comment_reply')),
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

-- Belt-and-braces duplicate guard: at insert time comment_id is always the
-- freshly created comment's own id (never null yet), so this prevents ever
-- inserting two rows for the same (comment, recipient) pair even if the
-- trigger below were ever invoked twice for the same comment. It has no
-- effect on old rows once comment_id later goes null via its own FK (SQL
-- treats NULLs as distinct from each other by default), so it does not
-- fight comment_id's "on delete set null" behavior.
alter table public.notifications
  add constraint notifications_comment_recipient_unique unique (comment_id, user_id);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
create index notifications_user_id_read_at_idx on public.notifications (user_id, read_at);
create index notifications_comment_id_idx on public.notifications (comment_id);

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
-- Column-level: authenticated may only ever change read_at, never any other
-- column (user_id, actor_user_id, recommendation_id, comment_id, type,
-- created_at, id all stay unwritable by any client).
grant update (read_at) on public.notifications to authenticated;

create policy "Users can view their own notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);

-- No INSERT policy/grant at all: notifications are only ever created by the
-- SECURITY DEFINER trigger function below, which (as the function owner)
-- bypasses RLS entirely. A client has no INSERT privilege on this table, so
-- a direct INSERT attempt is rejected before RLS is even evaluated.
-- USING requires the existing row to still be unread, so the only allowed
-- transition is read_at NULL -> NOT NULL: a client cannot re-touch a
-- notification that has already been marked read (that UPDATE simply
-- matches zero rows rather than erroring, since USING is checked against
-- the row as it is before the update).
create policy "Users can mark their own notifications as read"
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id and read_at is null)
with check ((select auth.uid()) = user_id and read_at is not null);

-- Creates notifications for a new comment/reply, database-side, so this
-- cannot be skipped or forged by client code. SECURITY DEFINER is required
-- because authenticated users have no INSERT grant on public.notifications
-- (see above) -- the function runs with its owner's privileges (the role
-- that executes this migration, e.g. postgres), which is exempt from its
-- own table's RLS by default. search_path is pinned so it cannot be
-- hijacked by a same-named object created earlier in a session's path, and
-- every object it touches is schema-qualified regardless.
create or replace function public.create_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := new.user_id;
  owner_id uuid;
  reply_target_user_id uuid;
begin
  -- Defensive: comments are only ever inserted with deleted_at null (see
  -- migration 009's insert policy), but this keeps the trigger correct even
  -- if that ever changes.
  if new.deleted_at is not null then
    return new;
  end if;

  -- Joins against auth.users so a recommendation/comment left behind by a
  -- since-deleted account (recommendations.user_id has no FK of its own,
  -- so this can happen) never causes an insert here to fail with a foreign
  -- key violation -- it simply yields no recipient for that role instead.
  select r.user_id into owner_id
  from public.recommendations r
  join auth.users u on u.id = r.user_id
  where r.id = new.recommendation_id;

  if new.reply_to_comment_id is not null then
    select c.user_id into reply_target_user_id
    from public.comments c
    join auth.users u on u.id = c.user_id
    where c.id = new.reply_to_comment_id;
  end if;

  -- Rule B (direct reply target) is more specific, so it is inserted first;
  -- Rule A (recommendation owner) then skips anyone already notified above,
  -- so the same person never receives two notifications for one comment.
  if reply_target_user_id is not null and reply_target_user_id <> actor then
    insert into public.notifications (user_id, actor_user_id, recommendation_id, comment_id, type)
    values (reply_target_user_id, actor, new.recommendation_id, new.id, 'comment_reply')
    on conflict (comment_id, user_id) do nothing;
  end if;

  if owner_id is not null and owner_id <> actor and owner_id is distinct from reply_target_user_id then
    insert into public.notifications (user_id, actor_user_id, recommendation_id, comment_id, type)
    values (owner_id, actor, new.recommendation_id, new.id, 'recommendation_comment')
    on conflict (comment_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_create_notifications on public.comments;
create trigger comments_create_notifications
after insert on public.comments
for each row execute function public.create_comment_notifications();

-- A trigger invokes its function directly through the trigger manager, not
-- through a client's own EXECUTE call, so revoking EXECUTE here does not
-- stop the trigger from firing -- it only prevents any client role from
-- calling this SECURITY DEFINER function directly (e.g. `select
-- public.create_comment_notifications()`), which is not a legitimate way to
-- invoke it in the first place.
revoke execute on function public.create_comment_notifications() from public, anon, authenticated;

commit;
