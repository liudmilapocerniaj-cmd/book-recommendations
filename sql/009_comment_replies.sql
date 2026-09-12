-- Adds one-level replies to public.comments and converts user-initiated
-- deletion from a hard DELETE to a soft delete (deleted_at). Existing rows,
-- the public SELECT policy, and the insert-your-own-comment rule are kept;
-- only the delete path is replaced and two nullable columns are added.
begin;

alter table public.comments
  add column parent_id uuid null references public.comments(id) on delete set null,
  add column deleted_at timestamptz null;

-- Speeds up grouping replies under their parent and the FK's ON DELETE SET
-- NULL lookup when a parent row is hard-deleted (e.g. via account cascade).
create index comments_parent_id_idx on public.comments (parent_id);

-- Enforces exactly one level of nesting at the database, not just in the UI:
-- a reply's parent must exist, belong to the same recommendation, itself be
-- a top-level comment (parent_id is null), and not already be deleted.
-- RLS already lets any authenticated caller SELECT any row in this table, so
-- this reads the parent with the caller's own (invoker) privileges rather
-- than security definer.
create or replace function public.enforce_comment_reply_rules()
returns trigger
language plpgsql
as $$
declare
  parent public.comments%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  select * into parent from public.comments where id = new.parent_id;

  if not found then
    raise exception 'Parent comment does not exist.';
  end if;

  if parent.recommendation_id <> new.recommendation_id then
    raise exception 'Parent comment belongs to a different recommendation.';
  end if;

  if parent.parent_id is not null then
    raise exception 'Replies to replies are not allowed.';
  end if;

  if parent.deleted_at is not null then
    raise exception 'Cannot reply to a deleted comment.';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_enforce_reply_rules on public.comments;
create trigger comments_enforce_reply_rules
before insert on public.comments
for each row execute function public.enforce_comment_reply_rules();

-- Users can no longer physically delete a comment; deletion becomes an
-- update of deleted_at only, so replies survive their parent's removal.
drop policy "Users can delete their own comments" on public.comments;
revoke delete on public.comments from authenticated;

-- Re-created so a client cannot insert a row that is already marked deleted.
drop policy "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
on public.comments for insert to authenticated
with check ((select auth.uid()) = user_id and deleted_at is null);

-- Column-level grant: authenticated users get UPDATE on deleted_at only, never
-- on content/user_id/recommendation_id/parent_id/created_at/id. Postgres
-- enforces this at the privilege-check level, independent of RLS below.
revoke update on public.comments from authenticated;
grant update (deleted_at) on public.comments to authenticated;

create policy "Users can soft-delete their own comments"
on public.comments for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and deleted_at is not null);

-- Belt-and-braces: the client is only ever granted UPDATE on deleted_at (see
-- above), so it cannot send a request that touches content. This trigger is
-- the actual enforcement point that keeps the original text out of the
-- database once a comment is deleted, in case that column grant is ever
-- loosened by mistake. It runs BEFORE UPDATE, so it rewrites NEW.content
-- before the row is written and before the CHECK constraint and the RLS
-- WITH CHECK above evaluate the final row -- no elevated (security definer)
-- privileges are needed, since a BEFORE ROW trigger may freely set any
-- column of NEW regardless of the caller's own column-level grants.
create or replace function public.scrub_comment_on_delete()
returns trigger
language plpgsql
as $$
begin
  -- First transition into "deleted": replace the text so it is gone for good.
  if new.deleted_at is not null and old.deleted_at is null then
    new.content := '[deleted]';
  end if;

  -- Once deleted, deleted_at is frozen: no undeleting, no re-timestamping.
  -- (A no-op update that resends the same deleted_at is still allowed.)
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'Cannot change deleted_at once a comment has been deleted.';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_scrub_on_delete on public.comments;
create trigger comments_scrub_on_delete
before update on public.comments
for each row execute function public.scrub_comment_on_delete();

commit;
