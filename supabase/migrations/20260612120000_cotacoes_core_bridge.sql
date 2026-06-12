alter table if exists public.tenants
  add column if not exists core_empresa_id uuid references public.core_empresas(id) on delete set null;

alter table if exists public.users_profile
  add column if not exists core_usuario_id uuid references public.core_usuarios(id) on delete set null;

alter table if exists public.users_profile
  add column if not exists must_change_password boolean not null default false;

create unique index if not exists idx_tenants_core_empresa_id
  on public.tenants(core_empresa_id)
  where core_empresa_id is not null;

create unique index if not exists idx_users_profile_core_usuario_id
  on public.users_profile(core_usuario_id)
  where core_usuario_id is not null;

update public.tenants t
set core_empresa_id = e.id
from public.core_empresas e
where t.core_empresa_id is null
  and e.cnpj is not null
  and e.cnpj = t.cnpj;

update public.users_profile p
set core_usuario_id = u.id
from public.core_usuarios u
where p.core_usuario_id is null
  and lower(u.email) = lower(p.email);

insert into public.core_apps (slug, nome, descricao, url_path, ativo, ordem)
values (
  'mba-cotacoes',
  'MBA Cotações',
  'Sistema de cotações, vendedores, respostas e pedidos.',
  '/cotacoes',
  true,
  10
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  ativo = excluded.ativo,
  ordem = excluded.ordem;
