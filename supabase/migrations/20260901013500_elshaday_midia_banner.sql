alter table public.igreja_eventos
  add column if not exists banner_url text;

alter table public.igreja_pregacoes
  add column if not exists banner_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'igreja-midia',
  'igreja-midia',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
