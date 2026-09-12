-- Builds on migration 009 (already applied in production) without editing it.
-- Adds:
--   1) reply_to_comment_id -- who a reply is conversationally addressed to
--      (the thread's root, or another reply within the same thread).
--   2) thread_id -- the thread's permanent identity. It is set once, at
--      INSERT time, to the root comment's own id, and every reply in that
--      thread inherits the same value forever. Unlike parent_id, thread_id
--      is NOT a foreign key -- deliberately, so it survives even after the
--      root row itself is physically deleted (e.g. the root author's
--      account is removed via the existing user_id ON DELETE CASCADE).
--      parent_id's own "on delete set null" FK cannot preserve that
--      information once the referenced row is gone; thread_id, as a plain
--      UUID value with no FK, is untouched by that deletion. The UI groups
--      and classifies comments by thread_id, not by "parent_id is null", so
--      surviving replies are never miscategorized as new top-level comments
--      after their root is removed.
begin;

alter table public.comments
  add column reply_to_comment_id uuid null references public.comments(id) on delete set null,
  add column thread_id uuid null;

create index comments_reply_to_comment_id_idx on public.comments (reply_to_comment_id);
create index comments_thread_id_idx on public.comments (thread_id);

-- Backfill order: thread_id first, then reply_to_comment_id. Both are
-- derived independently from the pre-existing parent_id/id values, so the
-- order between them doesn't matter functionally, but thread_id is done
-- first here since reply_to_comment_id conceptually builds on top of it.

-- Backfill thread_id, part 1: every existing top-level row is the root of
-- its own thread.
update public.comments
set thread_id = id
where parent_id is null;

-- Backfill thread_id, part 2: every existing reply (created under migration
-- 009, which only supported direct replies to a root) belongs to the thread
-- named by its parent_id.
update public.comments
set thread_id = parent_id
where parent_id is not null;

-- Backfill reply_to_comment_id: every existing reply targeted its root
-- directly (that was the only shape possible before this migration).
update public.comments
set reply_to_comment_id = parent_id
where parent_id is not null and reply_to_comment_id is null;

-- Every row now has a thread_id; make that permanent. (Not a CHECK on any
-- cross-column relationship, just NOT NULL on this one column, so it is
-- unaffected by the parent_id/reply_to_comment_id CHECK problem discussed
-- in the previous revision of this migration.)
alter table public.comments
  alter column thread_id set not null;

-- Rewrites the migration-009 trigger of the same name. thread_id is never
-- taken from the client -- it is always derived here, either from NEW.id (a
-- fresh top-level comment becomes the root of its own new thread) or from
-- the reply target's own thread_id (a reply always joins its target's
-- thread). Because every row's thread_id was already validated when that
-- row itself was inserted, joining a live target's thread_id is always
-- correct by construction -- no separate "does this belong to the same
-- thread" lookup against a root row is needed anymore, which also means
-- this keeps working even after a thread's original root row is gone.
-- RLS still lets any authenticated caller SELECT any comment row, so this
-- keeps running with the caller's own (invoker) privileges, not security
-- definer.
create or replace function public.enforce_comment_reply_rules()
returns trigger
language plpgsql
as $$
declare
  target public.comments%rowtype;
  root_still_exists boolean;
begin
  if new.parent_id is null then
    if new.reply_to_comment_id is not null then
      raise exception 'A top-level comment cannot have a reply target.';
    end if;
    new.thread_id := new.id;
    return new;
  end if;

  if new.reply_to_comment_id is null then
    raise exception 'A reply must specify reply_to_comment_id.';
  end if;

  select * into target from public.comments where id = new.reply_to_comment_id;

  if not found then
    raise exception 'Reply target does not exist.';
  end if;

  if target.recommendation_id <> new.recommendation_id then
    raise exception 'Reply target belongs to a different recommendation.';
  end if;

  if target.deleted_at is not null then
    raise exception 'Cannot reply to a deleted comment.';
  end if;

  new.thread_id := target.thread_id;

  -- parent_id is kept only as a best-effort, backward-compatible pointer to
  -- the thread's original root row -- but only while that row still
  -- exists, since parent_id (unlike thread_id) is a real foreign key and
  -- cannot reference an id that is no longer present in the table.
  select exists (select 1 from public.comments where id = target.thread_id) into root_still_exists;
  if root_still_exists then
    new.parent_id := target.thread_id;
  else
    new.parent_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_enforce_reply_rules on public.comments;
create trigger comments_enforce_reply_rules
before insert on public.comments
for each row execute function public.enforce_comment_reply_rules();

-- No client privileges on any structural/identity column: none of these are
-- ever granted for UPDATE, so a client cannot rewrite a comment's thread,
-- reply target, or place in the tree after the fact. deleted_at remains the
-- only column authenticated may update (see migration 009).
revoke update (thread_id) on public.comments from authenticated;
revoke update (parent_id) on public.comments from authenticated;
revoke update (reply_to_comment_id) on public.comments from authenticated;

commit;
