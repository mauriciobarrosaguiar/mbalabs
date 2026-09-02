create table if not exists public.igreja_biblia_capitulos_lidos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  livro_id text not null,
  capitulo integer not null check (capitulo > 0 and capitulo <= 150),
  lido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (igreja_id, user_id, livro_id, capitulo)
);

create index if not exists igreja_biblia_capitulos_lidos_user_idx
  on public.igreja_biblia_capitulos_lidos(igreja_id, user_id, livro_id, capitulo);

alter table public.igreja_biblia_capitulos_lidos enable row level security;

drop policy if exists igreja_biblia_capitulos_lidos_own on public.igreja_biblia_capitulos_lidos;
create policy igreja_biblia_capitulos_lidos_own
on public.igreja_biblia_capitulos_lidos
for all to authenticated
using (
  user_id = (select auth.uid())
  and private.igreja_can_access(igreja_id)
)
with check (
  user_id = (select auth.uid())
  and private.igreja_can_access(igreja_id)
);
