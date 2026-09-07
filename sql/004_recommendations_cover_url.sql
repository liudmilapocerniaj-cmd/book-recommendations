-- Adds an optional cover URL. Existing rows receive NULL; no data is deleted.
alter table public.recommendations
add column if not exists cover_url text;
