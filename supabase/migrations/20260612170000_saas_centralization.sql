create extension if not exists pgcrypto;

create table if not exists public.core_empresa_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  descricao text,
  status text not null default 'ativa' check (status in ('ativa', 'inativa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.core_empresa_categorias (nome, slug, descricao, status)
values
  ('Farmacia', 'farmacia', 'Farmacias e redes farmaceuticas.', 'ativa'),
  ('Drogaria', 'drogaria', 'Drogarias independentes ou redes.', 'ativa'),
  ('Distribuidora', 'distribuidora', 'Distribuidoras e atacadistas.', 'ativa'),
  ('Lava Jato', 'lava-jato', 'Lava jatos e esteticas automotivas.', 'ativa'),
  ('Estetica Automotiva', 'estetica-automotiva', 'Empresas de estetica automotiva.', 'ativa'),
  ('Clinica', 'clinica', 'Clinicas e prestadores de saude.', 'ativa'),
  ('Guincho', 'guincho', 'Empresas de guincho e assistencia.', 'ativa'),
  ('Agro', 'agro', 'Empresas do agronegocio.', 'ativa'),
  ('Outros', 'outros', 'Categoria geral para empresas nao classificadas.', 'ativa')
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  status = excluded.status,
  updated_at = now();

alter table public.core_empresas add column if not exists categoria_id uuid;
alter table public.core_empresas add column if not exists razao_social text;
alter table public.core_empresas add column if not exists whatsapp text;
alter table public.core_empresas add column if not exists responsavel text;
alter table public.core_empresas add column if not exists observacoes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'core_empresas_categoria_id_fkey'
  ) then
    alter table public.core_empresas
      add constraint core_empresas_categoria_id_fkey
      foreign key (categoria_id) references public.core_empresa_categorias(id);
  end if;
end;
$$;

update public.core_empresas
set
  nome_fantasia = coalesce(nome_fantasia, nome),
  razao_social = coalesce(razao_social, nome),
  categoria_id = coalesce(
    categoria_id,
    (select id from public.core_empresa_categorias where slug = 'outros')
  )
where categoria_id is null
   or nome_fantasia is null
   or razao_social is null;

alter table public.core_empresas alter column categoria_id set not null;

alter table public.core_empresas drop constraint if exists core_empresas_status_check;
update public.core_empresas set status = 'cancelada' where status = 'inativa';
alter table public.core_empresas
  add constraint core_empresas_status_check
  check (status in ('ativa', 'teste', 'bloqueada', 'cancelada'));

alter table public.core_usuarios add column if not exists tipo_global text;
alter table public.core_usuarios add column if not exists senha_hash text;

alter table public.core_usuarios drop constraint if exists core_usuarios_tipo_check;
alter table public.core_usuarios drop constraint if exists core_usuarios_status_check;

update public.core_usuarios
set tipo_global = coalesce(tipo_global, tipo, 'usuario');

alter table public.core_usuarios alter column tipo_global set default 'usuario';
alter table public.core_usuarios
  add constraint core_usuarios_tipo_check
  check (tipo in ('super_admin', 'admin_master', 'admin_empresa', 'operador', 'usuario', 'vendedor', 'funcionario'));
alter table public.core_usuarios
  add constraint core_usuarios_tipo_global_check
  check (tipo_global in ('super_admin', 'admin_master', 'admin_empresa', 'operador', 'usuario', 'vendedor', 'funcionario'));
alter table public.core_usuarios
  add constraint core_usuarios_status_check
  check (status in ('ativo', 'inativo', 'bloqueado', 'pendente'));
alter table public.core_usuarios
  add constraint core_usuarios_empresa_required_check
  check (empresa_id is not null or tipo in ('super_admin', 'admin_master')) not valid;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'ux_core_usuarios_email_lower'
  )
  and not exists (
    select 1
    from (
      select lower(email) as email_key
      from public.core_usuarios
      group by lower(email)
      having count(*) > 1
    ) duplicated
  ) then
    create unique index ux_core_usuarios_email_lower on public.core_usuarios (lower(email));
  end if;
end;
$$;

create or replace function public.sync_core_usuario_tipo()
returns trigger
language plpgsql
as $$
begin
  if new.tipo_global is null then
    new.tipo_global := coalesce(new.tipo, 'usuario');
  end if;

  if new.tipo is null or new.tipo <> new.tipo_global then
    new.tipo := new.tipo_global;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_core_usuario_tipo_trigger on public.core_usuarios;
create trigger sync_core_usuario_tipo_trigger
before insert or update on public.core_usuarios
for each row execute function public.sync_core_usuario_tipo();

alter table public.core_apps add column if not exists url_interna text;
alter table public.core_apps add column if not exists url_externa text;
alter table public.core_apps add column if not exists logo_icone text;
alter table public.core_apps add column if not exists status text not null default 'ativo';
alter table public.core_apps add column if not exists updated_at timestamptz not null default now();

alter table public.core_apps drop constraint if exists core_apps_status_check;
alter table public.core_apps
  add constraint core_apps_status_check
  check (status in ('ativo', 'inativo'));

update public.core_apps
set
  url_interna = coalesce(url_interna, url_path),
  status = case when ativo then 'ativo' else 'inativo' end,
  updated_at = now();

create or replace function public.sync_core_app_legacy()
returns trigger
language plpgsql
as $$
begin
  if new.status is null then
    new.status := case when coalesce(new.ativo, true) then 'ativo' else 'inativo' end;
  end if;

  new.ativo := new.status = 'ativo';

  if new.url_interna is null then
    new.url_interna := new.url_path;
  end if;

  if new.url_path is null then
    new.url_path := new.url_interna;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_core_app_legacy_trigger on public.core_apps;
create trigger sync_core_app_legacy_trigger
before insert or update on public.core_apps
for each row execute function public.sync_core_app_legacy();

insert into public.core_apps (slug, nome, descricao, url_path, url_interna, url_externa, logo_icone, status, ativo, ordem)
values
  (
    'mba-cotacoes',
    'MBA Cotacoes',
    'Sistema de cotacoes, vendedores, respostas e pedidos.',
    '/apps/mbacotacoes',
    '/apps/mbacotacoes',
    'https://mbacotacoes.vercel.app/',
    'FileText',
    'ativo',
    true,
    10
  ),
  (
    'lavagestor',
    'LavaGestor',
    'Sistema para gestao de lava-jatos, lavagens, vales e comissoes.',
    '/apps/lavagestor',
    '/apps/lavagestor',
    'https://lavagestor.vercel.app/login',
    'Car',
    'ativo',
    true,
    20
  )
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  url_interna = excluded.url_interna,
  url_externa = excluded.url_externa,
  logo_icone = excluded.logo_icone,
  status = excluded.status,
  ativo = excluded.ativo,
  ordem = excluded.ordem,
  updated_at = now();

create table if not exists public.core_empresa_apps (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  app_id uuid not null references public.core_apps(id) on delete cascade,
  plano_id uuid references public.core_planos(id),
  status text not null default 'ativo' check (status in ('ativo', 'teste', 'vencido', 'bloqueado', 'cancelado')),
  data_inicio date not null default current_date,
  data_vencimento date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, app_id)
);

insert into public.core_empresa_apps (
  empresa_id,
  app_id,
  plano_id,
  status,
  data_inicio,
  data_vencimento,
  created_at,
  updated_at
)
select
  empresa_id,
  app_id,
  plano_id,
  case status
    when 'ativa' then 'ativo'
    when 'bloqueada' then 'bloqueado'
    when 'vencida' then 'vencido'
    else status
  end,
  inicio,
  vencimento,
  created_at,
  updated_at
from public.core_assinaturas
on conflict (empresa_id, app_id) do update set
  plano_id = excluded.plano_id,
  status = excluded.status,
  data_inicio = excluded.data_inicio,
  data_vencimento = excluded.data_vencimento,
  updated_at = now();

create table if not exists public.core_usuario_app_permissoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.core_usuarios(id) on delete cascade,
  empresa_id uuid references public.core_empresas(id) on delete cascade,
  app_id uuid not null references public.core_apps(id) on delete cascade,
  perfil_app text not null default 'usuario',
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'bloqueado', 'pendente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id, app_id)
);

insert into public.core_usuario_app_permissoes (
  usuario_id,
  empresa_id,
  app_id,
  perfil_app,
  status,
  created_at,
  updated_at
)
select
  p.usuario_id,
  u.empresa_id,
  p.app_id,
  p.perfil,
  case when p.pode_acessar then 'ativo' else 'bloqueado' end,
  p.created_at,
  now()
from public.core_permissoes p
join public.core_usuarios u on u.id = p.usuario_id
on conflict (usuario_id, app_id) do update set
  empresa_id = excluded.empresa_id,
  perfil_app = excluded.perfil_app,
  status = excluded.status,
  updated_at = now();

create or replace function public.validate_usuario_app_permissao()
returns trigger
language plpgsql
as $$
declare
  user_empresa uuid;
  user_tipo text;
begin
  select empresa_id, tipo into user_empresa, user_tipo
  from public.core_usuarios
  where id = new.usuario_id;

  if new.empresa_id is null then
    new.empresa_id := user_empresa;
  end if;

  if user_tipo not in ('super_admin', 'admin_master') and new.empresa_id is distinct from user_empresa then
    raise exception 'Permissao deve pertencer a empresa do usuario.';
  end if;

  if user_tipo not in ('super_admin', 'admin_master') and not exists (
    select 1
    from public.core_empresa_apps ea
    where ea.empresa_id = new.empresa_id
      and ea.app_id = new.app_id
      and ea.status in ('ativo', 'teste')
      and (ea.data_vencimento is null or ea.data_vencimento >= current_date)
  ) then
    raise exception 'A empresa do usuario nao possui este app ativo.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_usuario_app_permissao_trigger on public.core_usuario_app_permissoes;
create trigger validate_usuario_app_permissao_trigger
before insert or update on public.core_usuario_app_permissoes
for each row execute function public.validate_usuario_app_permissao();

drop trigger if exists set_core_empresa_categorias_updated_at on public.core_empresa_categorias;
create trigger set_core_empresa_categorias_updated_at
before update on public.core_empresa_categorias
for each row execute function public.set_updated_at();

drop trigger if exists set_core_apps_updated_at on public.core_apps;
create trigger set_core_apps_updated_at
before update on public.core_apps
for each row execute function public.set_updated_at();

drop trigger if exists set_core_empresa_apps_updated_at on public.core_empresa_apps;
create trigger set_core_empresa_apps_updated_at
before update on public.core_empresa_apps
for each row execute function public.set_updated_at();

drop trigger if exists set_core_usuario_app_permissoes_updated_at on public.core_usuario_app_permissoes;
create trigger set_core_usuario_app_permissoes_updated_at
before update on public.core_usuario_app_permissoes
for each row execute function public.set_updated_at();

create index if not exists idx_core_empresa_categorias_status on public.core_empresa_categorias(status, nome);
create index if not exists idx_core_empresas_categoria_status on public.core_empresas(categoria_id, status);
create index if not exists idx_core_empresa_apps_empresa_status on public.core_empresa_apps(empresa_id, status);
create index if not exists idx_core_empresa_apps_app_status on public.core_empresa_apps(app_id, status);
create index if not exists idx_core_usuario_app_permissoes_usuario_status on public.core_usuario_app_permissoes(usuario_id, status);
create index if not exists idx_core_usuario_app_permissoes_empresa_app on public.core_usuario_app_permissoes(empresa_id, app_id);

create or replace function public.current_usuario_tipo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.tipo_global, u.tipo)
  from public.core_usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.is_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_usuario_tipo() in ('super_admin', 'admin_master'), false);
$$;

create or replace function public.can_access_app(app_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with requested_apps as (
    select id, slug
    from public.core_apps
    where status = 'ativo'
      and ativo = true
      and (
        slug = app_slug
        or (app_slug = 'mbacotacoes' and slug = 'mba-cotacoes')
        or (app_slug = 'mba-cotacoes' and slug = 'mbacotacoes')
      )
  )
  select public.is_admin_master()
    or exists (
      select 1
      from public.core_usuario_app_permissoes p
      join requested_apps a on a.id = p.app_id
      join public.core_empresa_apps ea on ea.empresa_id = p.empresa_id and ea.app_id = p.app_id
      join public.core_empresas e on e.id = p.empresa_id
      where p.usuario_id = public.current_usuario_id()
        and p.status = 'ativo'
        and e.status in ('ativa', 'teste')
        and ea.status in ('ativo', 'teste')
        and (ea.data_vencimento is null or ea.data_vencimento >= current_date)
    )
    or exists (
      select 1
      from public.core_empresa_apps ea
      join requested_apps a on a.id = ea.app_id
      join public.core_empresas e on e.id = ea.empresa_id
      where ea.empresa_id = public.current_empresa_id()
        and public.current_usuario_tipo() = 'admin_empresa'
        and e.status in ('ativa', 'teste')
        and ea.status in ('ativo', 'teste')
        and (ea.data_vencimento is null or ea.data_vencimento >= current_date)
    )
    or exists (
      select 1
      from public.core_permissoes p
      join requested_apps a on a.id = p.app_id
      where p.usuario_id = public.current_usuario_id()
        and p.pode_acessar = true
    )
    or exists (
      select 1
      from public.core_assinaturas s
      join requested_apps a on a.id = s.app_id
      where s.empresa_id = public.current_empresa_id()
        and s.status in ('ativa', 'teste')
        and (s.vencimento is null or s.vencimento >= current_date)
    );
$$;

alter table public.core_empresa_categorias enable row level security;
alter table public.core_empresa_apps enable row level security;
alter table public.core_usuario_app_permissoes enable row level security;

drop policy if exists core_empresa_categorias_select on public.core_empresa_categorias;
create policy core_empresa_categorias_select on public.core_empresa_categorias
  for select to authenticated
  using (status = 'ativa' or public.is_admin_master());

drop policy if exists core_empresa_categorias_master_manage on public.core_empresa_categorias;
create policy core_empresa_categorias_master_manage on public.core_empresa_categorias
  for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

drop policy if exists core_empresa_apps_select on public.core_empresa_apps;
create policy core_empresa_apps_select on public.core_empresa_apps
  for select to authenticated
  using (public.is_admin_master() or empresa_id = public.current_empresa_id());

drop policy if exists core_empresa_apps_master_manage on public.core_empresa_apps;
create policy core_empresa_apps_master_manage on public.core_empresa_apps
  for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

drop policy if exists core_usuario_app_permissoes_select on public.core_usuario_app_permissoes;
create policy core_usuario_app_permissoes_select on public.core_usuario_app_permissoes
  for select to authenticated
  using (
    public.is_admin_master()
    or empresa_id = public.current_empresa_id()
    or usuario_id = public.current_usuario_id()
  );

drop policy if exists core_usuario_app_permissoes_manage on public.core_usuario_app_permissoes;
create policy core_usuario_app_permissoes_manage on public.core_usuario_app_permissoes
  for all to authenticated
  using (
    public.is_admin_master()
    or (empresa_id = public.current_empresa_id() and public.current_usuario_tipo() = 'admin_empresa')
  )
  with check (
    public.is_admin_master()
    or (empresa_id = public.current_empresa_id() and public.current_usuario_tipo() = 'admin_empresa')
  );

grant execute on function public.current_usuario_tipo() to authenticated;
grant execute on function public.is_admin_master() to authenticated;
grant execute on function public.can_access_app(text) to authenticated;
