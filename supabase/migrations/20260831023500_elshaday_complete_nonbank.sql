-- Elshaday: conclusão dos módulos não bancários.

alter table public.igreja_financeiro_entradas
  add column if not exists alterado_em timestamptz,
  add column if not exists alterado_por uuid references auth.users(id) on delete set null,
  add column if not exists estornado_em timestamptz,
  add column if not exists estornado_por uuid references auth.users(id) on delete set null,
  add column if not exists estorno_motivo text;

create table if not exists public.igreja_financeiro_fechamentos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  competencia text not null,
  total_calculado numeric(14,2) not null default 0,
  resumo jsonb not null default '{}'::jsonb,
  observacoes text,
  fechado_por uuid references auth.users(id) on delete set null,
  fechado_em timestamptz not null default now(),
  reaberto_por uuid references auth.users(id) on delete set null,
  reaberto_em timestamptz,
  reabertura_motivo text,
  status text not null default 'fechado'
    check (status in ('fechado','reaberto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (igreja_id, competencia)
);

alter table public.igreja_financeiro_fechamentos enable row level security;

drop policy if exists igreja_fin_fech_select on public.igreja_financeiro_fechamentos;
create policy igreja_fin_fech_select
on public.igreja_financeiro_fechamentos
for select to authenticated
using (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_fin_fech_insert on public.igreja_financeiro_fechamentos;
create policy igreja_fin_fech_insert
on public.igreja_financeiro_fechamentos
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_fin_fech_update on public.igreja_financeiro_fechamentos;
create policy igreja_fin_fech_update
on public.igreja_financeiro_fechamentos
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','tesouraria']))
with check (private.igreja_has_role(igreja_id, array['admin','tesouraria']));

revoke all on public.igreja_financeiro_fechamentos from anon;

create table if not exists public.igreja_membro_relacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  membro_id uuid not null references public.igreja_membros(id) on delete cascade,
  parente_id uuid not null references public.igreja_membros(id) on delete cascade,
  tipo text not null check (tipo in ('conjuge','pai','mae','filho','filha','irmao','irma','responsavel','dependente','outro')),
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (membro_id <> parente_id),
  unique (igreja_id, membro_id, parente_id, tipo)
);

alter table public.igreja_membro_relacoes enable row level security;

drop policy if exists igreja_rel_select on public.igreja_membro_relacoes;
create policy igreja_rel_select
on public.igreja_membro_relacoes
for select to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_rel_insert on public.igreja_membro_relacoes;
create policy igreja_rel_insert
on public.igreja_membro_relacoes
for insert to authenticated
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));

drop policy if exists igreja_rel_update on public.igreja_membro_relacoes;
create policy igreja_rel_update
on public.igreja_membro_relacoes
for update to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']))
with check (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));

drop policy if exists igreja_rel_delete on public.igreja_membro_relacoes;
create policy igreja_rel_delete
on public.igreja_membro_relacoes
for delete to authenticated
using (private.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));

revoke all on public.igreja_membro_relacoes from anon;

create unique index if not exists igreja_biblia_anotacoes_user_ref_uidx
  on public.igreja_biblia_anotacoes(igreja_id, user_id, referencia);

alter table public.igreja_pregacoes
  add column if not exists status text not null default 'ativo';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.igreja_pregacoes'::regclass
      and conname='igreja_pregacoes_status_check'
  ) then
    alter table public.igreja_pregacoes
      add constraint igreja_pregacoes_status_check
      check (status in ('ativo','arquivado'));
  end if;
end $$;

create index if not exists igreja_eventos_igreja_status_inicio_idx
  on public.igreja_eventos(igreja_id,status,inicio desc);

create index if not exists igreja_pregacoes_igreja_status_data_idx
  on public.igreja_pregacoes(igreja_id,status,data_pregacao desc);

create index if not exists igreja_financeiro_fechamentos_igreja_comp_idx
  on public.igreja_financeiro_fechamentos(igreja_id,competencia desc);

create index if not exists igreja_membro_relacoes_membro_idx
  on public.igreja_membro_relacoes(igreja_id,membro_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'igreja-membros',
  'igreja-membros',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];
