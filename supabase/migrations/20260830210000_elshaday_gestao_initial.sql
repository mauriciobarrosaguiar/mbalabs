-- Elshaday Gestão - módulo de igrejas do MBA Labs
-- Estrutura multi-igreja, controle de acesso e segregação financeira.

create table if not exists public.igreja_igrejas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid unique references public.core_empresas(id) on delete set null,
  slug text not null unique,
  nome text not null,
  nome_curto text not null default 'Elshaday',
  cnpj text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  cidade text,
  estado varchar(2),
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.igreja_membros (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  data_nascimento date,
  cpf text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  bairro text,
  cidade text,
  estado varchar(2),
  data_conversao date,
  data_batismo date,
  data_entrada date,
  cargo text,
  ministerio text,
  situacao text not null default 'ativo'
    check (situacao in ('ativo','afastado','visitante','transferido','inativo')),
  observacoes text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists igreja_membros_igreja_user_uidx
  on public.igreja_membros(igreja_id, user_id)
  where user_id is not null;

create index if not exists igreja_membros_igreja_nome_idx
  on public.igreja_membros(igreja_id, nome);

create table if not exists public.igreja_perfis (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null
    check (papel in ('admin','pastor','tesouraria','secretaria','lider','membro')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (igreja_id, user_id)
);

create index if not exists igreja_perfis_user_idx
  on public.igreja_perfis(user_id, igreja_id);

create table if not exists public.igreja_eventos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'culto',
  descricao text,
  inicio timestamptz not null,
  fim timestamptz,
  local text,
  pregador text,
  dirigente text,
  tema text,
  texto_biblico text,
  publico text default 'todos',
  status text not null default 'agendado'
    check (status in ('agendado','realizado','cancelado')),
  banner_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists igreja_eventos_igreja_inicio_idx
  on public.igreja_eventos(igreja_id, inicio desc);

create table if not exists public.igreja_evento_presencas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  evento_id uuid not null references public.igreja_eventos(id) on delete cascade,
  membro_id uuid not null references public.igreja_membros(id) on delete cascade,
  presente boolean not null default true,
  registrado_em timestamptz not null default now(),
  unique (evento_id, membro_id)
);

create table if not exists public.igreja_pregacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  evento_id uuid references public.igreja_eventos(id) on delete set null,
  titulo text not null,
  tema text,
  pregador text not null,
  data_pregacao date not null default current_date,
  texto_base text,
  versiculos text[] not null default '{}',
  esboco text,
  introducao text,
  pontos jsonb not null default '[]'::jsonb,
  conclusao text,
  observacoes text,
  video_url text,
  audio_url text,
  arquivo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists igreja_pregacoes_igreja_data_idx
  on public.igreja_pregacoes(igreja_id, data_pregacao desc);

create table if not exists public.igreja_financeiro_entradas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  membro_id uuid references public.igreja_membros(id) on delete set null,
  evento_id uuid references public.igreja_eventos(id) on delete set null,
  tipo text not null
    check (tipo in ('dizimo','oferta','oferta_especial','campanha','outro')),
  descricao text,
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text not null default 'dinheiro'
    check (forma_pagamento in ('dinheiro','pix','cartao','transferencia','outro')),
  data_entrada date not null default current_date,
  anonimo boolean not null default false,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists igreja_financeiro_igreja_data_idx
  on public.igreja_financeiro_entradas(igreja_id, data_entrada desc);

create index if not exists igreja_financeiro_membro_idx
  on public.igreja_financeiro_entradas(igreja_id, membro_id)
  where membro_id is not null;

create table if not exists public.igreja_biblia_favoritos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  referencia text not null,
  texto text,
  traducao text not null default 'almeida',
  created_at timestamptz not null default now(),
  unique (igreja_id, user_id, referencia, traducao)
);

create table if not exists public.igreja_biblia_anotacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igreja_igrejas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  referencia text not null,
  anotacao text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists igreja_biblia_anotacoes_user_idx
  on public.igreja_biblia_anotacoes(igreja_id, user_id, referencia);

create or replace function public.igreja_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.core_usuarios u
    where u.id = auth.uid()
      and u.tipo in ('super_admin', 'admin_master')
      and u.status = 'ativo'
  );
$$;

create or replace function public.igreja_has_role(p_igreja_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.igreja_is_super_admin()
    or exists (
      select 1
      from public.igreja_perfis p
      where p.igreja_id = p_igreja_id
        and p.user_id = auth.uid()
        and p.ativo = true
        and p.papel = any(p_roles)
    );
$$;

create or replace function public.igreja_can_access(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.igreja_is_super_admin()
    or exists (
      select 1
      from public.igreja_perfis p
      where p.igreja_id = p_igreja_id
        and p.user_id = auth.uid()
        and p.ativo = true
    );
$$;

revoke all on function public.igreja_is_super_admin() from public;
revoke all on function public.igreja_has_role(uuid, text[]) from public;
revoke all on function public.igreja_can_access(uuid) from public;
grant execute on function public.igreja_is_super_admin() to authenticated;
grant execute on function public.igreja_has_role(uuid, text[]) to authenticated;
grant execute on function public.igreja_can_access(uuid) to authenticated;

alter table public.igreja_igrejas enable row level security;
alter table public.igreja_membros enable row level security;
alter table public.igreja_perfis enable row level security;
alter table public.igreja_eventos enable row level security;
alter table public.igreja_evento_presencas enable row level security;
alter table public.igreja_pregacoes enable row level security;
alter table public.igreja_financeiro_entradas enable row level security;
alter table public.igreja_biblia_favoritos enable row level security;
alter table public.igreja_biblia_anotacoes enable row level security;

drop policy if exists igreja_igrejas_select on public.igreja_igrejas;
create policy igreja_igrejas_select on public.igreja_igrejas
for select to authenticated
using (public.igreja_can_access(id));

drop policy if exists igreja_membros_select on public.igreja_membros;
create policy igreja_membros_select on public.igreja_membros
for select to authenticated
using (public.igreja_can_access(igreja_id));

drop policy if exists igreja_membros_write on public.igreja_membros;
create policy igreja_membros_write on public.igreja_membros
for all to authenticated
using (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria']))
with check (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria']));

drop policy if exists igreja_perfis_select on public.igreja_perfis;
create policy igreja_perfis_select on public.igreja_perfis
for select to authenticated
using (public.igreja_can_access(igreja_id));

drop policy if exists igreja_perfis_write on public.igreja_perfis;
create policy igreja_perfis_write on public.igreja_perfis
for all to authenticated
using (public.igreja_has_role(igreja_id, array['admin','pastor']))
with check (public.igreja_has_role(igreja_id, array['admin','pastor']));

drop policy if exists igreja_eventos_select on public.igreja_eventos;
create policy igreja_eventos_select on public.igreja_eventos
for select to authenticated
using (public.igreja_can_access(igreja_id));

drop policy if exists igreja_eventos_write on public.igreja_eventos;
create policy igreja_eventos_write on public.igreja_eventos
for all to authenticated
using (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']))
with check (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_evento_presencas_select on public.igreja_evento_presencas;
create policy igreja_evento_presencas_select on public.igreja_evento_presencas
for select to authenticated
using (public.igreja_can_access(igreja_id));

drop policy if exists igreja_evento_presencas_write on public.igreja_evento_presencas;
create policy igreja_evento_presencas_write on public.igreja_evento_presencas
for all to authenticated
using (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']))
with check (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_pregacoes_select on public.igreja_pregacoes;
create policy igreja_pregacoes_select on public.igreja_pregacoes
for select to authenticated
using (public.igreja_can_access(igreja_id));

drop policy if exists igreja_pregacoes_write on public.igreja_pregacoes;
create policy igreja_pregacoes_write on public.igreja_pregacoes
for all to authenticated
using (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']))
with check (public.igreja_has_role(igreja_id, array['admin','pastor','secretaria','lider']));

drop policy if exists igreja_financeiro_select on public.igreja_financeiro_entradas;
create policy igreja_financeiro_select on public.igreja_financeiro_entradas
for select to authenticated
using (public.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_financeiro_write on public.igreja_financeiro_entradas;
create policy igreja_financeiro_write on public.igreja_financeiro_entradas
for all to authenticated
using (public.igreja_has_role(igreja_id, array['admin','tesouraria']))
with check (public.igreja_has_role(igreja_id, array['admin','tesouraria']));

drop policy if exists igreja_biblia_favoritos_own on public.igreja_biblia_favoritos;
create policy igreja_biblia_favoritos_own on public.igreja_biblia_favoritos
for all to authenticated
using (user_id = auth.uid() and public.igreja_can_access(igreja_id))
with check (user_id = auth.uid() and public.igreja_can_access(igreja_id));

drop policy if exists igreja_biblia_anotacoes_own on public.igreja_biblia_anotacoes;
create policy igreja_biblia_anotacoes_own on public.igreja_biblia_anotacoes
for all to authenticated
using (user_id = auth.uid() and public.igreja_can_access(igreja_id))
with check (user_id = auth.uid() and public.igreja_can_access(igreja_id));

grant select, insert, update, delete on
  public.igreja_igrejas,
  public.igreja_membros,
  public.igreja_perfis,
  public.igreja_eventos,
  public.igreja_evento_presencas,
  public.igreja_pregacoes,
  public.igreja_financeiro_entradas,
  public.igreja_biblia_favoritos,
  public.igreja_biblia_anotacoes
to authenticated;

insert into public.core_apps (
  id, slug, nome, descricao, url_path, url_interna, ativo, status, ordem, logo_icone
)
values (
  gen_random_uuid(),
  'elshaday',
  'Elshaday Gestão',
  'Gestão de membros, dízimos e ofertas, cultos, eventos, pregações e Bíblia online.',
  '/elshaday',
  '/elshaday',
  true,
  'ativo',
  110,
  'church'
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  url_interna = excluded.url_interna,
  ativo = true,
  status = 'ativo',
  ordem = excluded.ordem,
  logo_icone = excluded.logo_icone,
  updated_at = now();

insert into public.igreja_igrejas (
  slug, nome, nome_curto, cidade, estado, ativa
)
values (
  'assembleia-de-deus-elshaday-palmas',
  'Igreja Assembleia de Deus Elshaday - Palmas',
  'Elshaday Palmas',
  'Palmas',
  'TO',
  true
)
on conflict (slug) do update set
  nome = excluded.nome,
  nome_curto = excluded.nome_curto,
  cidade = excluded.cidade,
  estado = excluded.estado,
  ativa = true,
  updated_at = now();
