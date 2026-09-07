-- Adds an optional genre. Existing recommendations keep NULL; no data is removed.
alter table public.recommendations add column if not exists genre text;
