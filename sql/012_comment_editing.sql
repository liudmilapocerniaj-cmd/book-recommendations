-- Adds comment/reply editing to public.comments. Does not modify migrations
-- 008, 009, 010, or 011 -- it only adds one nullable column, widens the
-- existing column-level UPDATE grant to include content, replaces the
-- UPDATE RLS policy from migration 009, and replaces the UPDATE trigger
-- that migration 009 introduced (comments_scrub_on_delete) with a single
-- clearer one that handles both editing and soft-delete, since stacking two
-- overlapping BEFORE UPDATE triggers on the same table would be confusing
-- and order-dependent. The 011 notification trigger is AFTER INSERT only
-- and is completely untouched by anything here.
begin;

alter table public.comments
  add column edited_at timestamptz null;

-- Column-level grants: authenticated may now UPDATE content (for editing)
-- in addition to deleted_at (for soft-delete, granted by migration 009).
-- edited_at is explicitly never granted -- only the trigger below may set
-- it, so a client cannot fake or backdate an edit timestamp. Every other
-- column (id, user_id, recommendation_id, parent_id, reply_to_comment_id,
-- thread_id, created_at) remains ungranted, as established in migrations
-- 009 and 010.
grant update (content) on public.comments to authenticated;
revoke update (edited_at) on public.comments from authenticated;

-- Replaces migration 009's "Users can soft-delete their own comments"
-- policy. USING now also requires the existing row to be active
-- (deleted_at is null), so an UPDATE against an already-deleted comment
-- matches zero rows and is rejected before it ever reaches a trigger --
-- this is what makes both editing and soft-deleting safe under the same
-- policy: editing must only ever start from an active comment, and so must
-- soft-delete. WITH CHECK keeps ownership fixed on the resulting row; it
-- does not otherwise constrain the new deleted_at value; both content edits
-- (deleted_at stays null) and soft-deletes (deleted_at becomes non-null)
-- are legitimate outcomes from an active row.
drop policy "Users can soft-delete their own comments" on public.comments;
create policy "Users can update their own active comments"
on public.comments for update to authenticated
using ((select auth.uid()) = user_id and deleted_at is null)
with check ((select auth.uid()) = user_id);

-- Replaces migration 009's scrub_comment_on_delete function/trigger with
-- one function that handles both normal edits and soft-delete, so there is
-- exactly one BEFORE UPDATE trigger on this table rather than two
-- overlapping ones.
drop trigger if exists comments_scrub_on_delete on public.comments;
drop function if exists public.scrub_comment_on_delete();

create or replace function public.handle_comment_update()
returns trigger
language plpgsql
as $$
begin
  -- Once deleted, a comment is frozen: no editing, no re-deleting, no
  -- undeleting, no touching edited_at. The UPDATE policy's USING clause
  -- (deleted_at is null) already keeps a client from reaching an
  -- already-deleted row at all; this is the belt-and-braces backstop in
  -- case that policy is ever loosened, or the row is reached some other way.
  if old.deleted_at is not null then
    raise exception 'Cannot modify a deleted comment.';
  end if;

  if new.deleted_at is not null then
    -- Soft delete: the timestamp is set server-side, never trusting
    -- whatever value the client's request carried, for the same reason
    -- edited_at below is always server-set. Content is scrubbed regardless
    -- of whatever text the request carried, and this transition is never
    -- treated as an edit (a deletion must never also show "Redaguota").
    new.deleted_at := now();
    new.content := '[deleted]';
    new.edited_at := old.edited_at;
    return new;
  end if;

  if new.content is distinct from old.content then
    -- A genuine content change on an active comment -- this, and only
    -- this, is what "Redaguota" means. Set here, server-side, so a client
    -- can never fake or backdate its own edited_at (it has no UPDATE grant
    -- on that column at all; this assignment happens regardless).
    new.edited_at := now();
  else
    -- No real change (e.g. re-saving identical text): never invent a new
    -- edited_at for a no-op update.
    new.edited_at := old.edited_at;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_handle_update on public.comments;
create trigger comments_handle_update
before update on public.comments
for each row execute function public.handle_comment_update();

commit;
