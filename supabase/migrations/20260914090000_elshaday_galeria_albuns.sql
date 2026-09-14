-- Elshaday: galeria privada com álbuns e fotos.
-- As tabelas ficam protegidas por RLS sem políticas públicas; o app acessa via servidor.

create table if not exists public.igreja_albuns (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 120),
  descricao text check (descricao is null or char_length(descricao) <= 1000),
  data_album date,
  visibilidade text not null default 'membros'
    check (visibilidade in ('membros', 'lideranca', 'administracao')),
  permitir_compartilhamento boolean not null default false,
  capa_storage_path text,
  ativo boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.igreja_album_fotos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  album_id uuid not null references public.igreja_albuns(id) on delete cascade,
  storage_path text not null,
  legenda text check (legenda is null or char_length(legenda) <= 300),
  ordem integer not null default 0 check (ordem between 0 and 99999),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (album_id, storage_path)
);

create index if not exists igreja_albuns_igreja_ativo_data_idx
  on public.igreja_albuns(igreja_id, ativo, data_album desc, created_at desc);

create index if not exists igreja_album_fotos_album_ordem_idx
  on public.igreja_album_fotos(album_id, ordem, created_at);

create index if not exists igreja_album_fotos_igreja_idx
  on public.igreja_album_fotos(igreja_id);

alter table public.igreja_albuns enable row level security;
alter table public.igreja_album_fotos enable row level security;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'igreja-galeria',
  'igreja-galeria',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
