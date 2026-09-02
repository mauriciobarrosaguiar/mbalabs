-- Elshaday: carrossel configurável da Home.
-- Perfis de conteúdo podem administrar; demais perfis somente visualizam itens ativos via app.

create table if not exists public.igreja_carrossel (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  titulo text,
  subtitulo text,
  imagem_url text not null,
  link_url text,
  ordem integer not null default 10 check (ordem >= 0),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists igreja_carrossel_igreja_ativo_ordem_idx
  on public.igreja_carrossel(igreja_id, ativo, ordem, created_at);

alter table public.igreja_carrossel enable row level security;

drop policy if exists igreja_carrossel_select on public.igreja_carrossel;
create policy igreja_carrossel_select
on public.igreja_carrossel
for select to authenticated
using (private.igreja_can_access(igreja_id));

drop policy if exists igreja_carrossel_insert on public.igreja_carrossel;
create policy igreja_carrossel_insert
on public.igreja_carrossel
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_carrossel_update on public.igreja_carrossel;
create policy igreja_carrossel_update
on public.igreja_carrossel
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_carrossel_delete on public.igreja_carrossel;
create policy igreja_carrossel_delete
on public.igreja_carrossel
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

revoke all on public.igreja_carrossel from anon;
grant select, insert, update, delete on public.igreja_carrossel to authenticated;
