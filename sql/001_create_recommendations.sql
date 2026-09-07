begin;

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  book_title text not null,
  book_author text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.recommendations enable row level security;

commit;