create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.core_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_fantasia text,
  cnpj text,
  telefone text,
  email text,
  cidade text,
  estado text,
  status text not null default 'ativa' check (status in ('ativa', 'inativa', 'bloqueada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.core_usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  empresa_id uuid references public.core_empresas(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  tipo text not null default 'usuario' check (tipo in ('admin_master', 'admin_empresa', 'usuario', 'vendedor', 'funcionario')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'bloqueado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id),
  unique (empresa_id, email)
);

create table if not exists public.core_apps (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  descricao text,
  url_path text,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.core_planos (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.core_apps(id) on delete cascade,
  nome text not null,
  descricao text,
  valor_mensal numeric(12,2) not null default 0,
  limite_usuarios int,
  limite_registros int,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (app_id, nome)
);

create table if not exists public.core_assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  app_id uuid not null references public.core_apps(id) on delete cascade,
  plano_id uuid references public.core_planos(id),
  status text not null default 'ativa' check (status in ('ativa', 'teste', 'vencida', 'cancelada', 'bloqueada')),
  inicio date not null default current_date,
  vencimento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.core_pagamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  assinatura_id uuid not null references public.core_assinaturas(id) on delete cascade,
  valor numeric(12,2) not null,
  vencimento date,
  pagamento_em timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'vencido', 'cancelado')),
  metodo text,
  referencia_externa text,
  created_at timestamptz not null default now()
);

create table if not exists public.core_permissoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.core_usuarios(id) on delete cascade,
  app_id uuid not null references public.core_apps(id) on delete cascade,
  pode_acessar boolean not null default true,
  perfil text not null default 'usuario',
  created_at timestamptz not null default now(),
  unique (usuario_id, app_id)
);

create table if not exists public.core_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.core_empresas(id),
  usuario_id uuid references public.core_usuarios(id),
  app_slug text,
  acao text not null,
  detalhes jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cot_produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  ean text,
  nome text not null,
  laboratorio text,
  apresentacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cot_vendedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  empresa_vendedora text,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cot_cotacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  titulo text not null,
  status text not null default 'aberta' check (status in ('aberta', 'finalizada', 'cancelada')),
  observacao text,
  criada_por uuid references public.core_usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cot_cotacao_itens (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cot_cotacoes(id) on delete cascade,
  produto_id uuid references public.cot_produtos(id),
  quantidade numeric(12,3) not null default 1,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.cot_respostas (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cot_cotacoes(id) on delete cascade,
  item_id uuid not null references public.cot_cotacao_itens(id) on delete cascade,
  vendedor_id uuid references public.cot_vendedores(id),
  preco numeric(12,2),
  comentario text,
  respondido_em timestamptz not null default now()
);

create table if not exists public.cot_pedidos (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cot_cotacoes(id) on delete cascade,
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  vendedor_id uuid references public.cot_vendedores(id),
  status text not null default 'gerado' check (status in ('gerado', 'enviado', 'faturado', 'nao_faturado', 'cancelado')),
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cot_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.cot_pedidos(id) on delete cascade,
  produto_id uuid references public.cot_produtos(id),
  quantidade numeric(12,3),
  preco numeric(12,2),
  total numeric(12,2),
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);

create table if not exists public.lava_clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  documento text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_veiculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  cliente_id uuid references public.lava_clientes(id) on delete cascade,
  placa text,
  modelo text,
  marca text,
  cor text,
  tipo text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_funcionarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  usuario_id uuid references public.core_usuarios(id),
  nome text not null,
  telefone text,
  percentual_comissao numeric(5,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_servicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  preco numeric(12,2) not null default 0,
  percentual_comissao numeric(5,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_lavagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  cliente_id uuid references public.lava_clientes(id),
  veiculo_id uuid references public.lava_veiculos(id),
  funcionario_id uuid references public.lava_funcionarios(id),
  servico_id uuid references public.lava_servicos(id),
  descricao_extra text,
  valor numeric(12,2) not null default 0,
  comissao numeric(12,2) not null default 0,
  status text not null default 'finalizada' check (status in ('aberta', 'em_andamento', 'finalizada', 'cancelada')),
  data_lavagem timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lava_comissoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  funcionario_id uuid not null references public.lava_funcionarios(id) on delete cascade,
  lavagem_id uuid not null references public.lava_lavagens(id) on delete cascade,
  valor numeric(12,2) not null default 0,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  pago_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lava_vales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  funcionario_id uuid not null references public.lava_funcionarios(id) on delete cascade,
  valor numeric(12,2) not null,
  descricao text,
  data_vale date not null default current_date,
  status text not null default 'aberto' check (status in ('aberto', 'descontado', 'cancelado')),
  created_at timestamptz not null default now()
);

create or replace function public.get_current_usuario()
returns public.core_usuarios
language sql
stable
security definer
set search_path = public
as $$
  select u
  from public.core_usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.current_usuario_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.core_usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.current_usuario_tipo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.tipo
  from public.core_usuarios u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;
$$;

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.empresa_id
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
  select coalesce(public.current_usuario_tipo() = 'admin_master', false);
$$;

create or replace function public.can_access_app(app_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_master()
    or exists (
      select 1
      from public.core_permissoes p
      join public.core_apps a on a.id = p.app_id
      where p.usuario_id = public.current_usuario_id()
        and p.pode_acessar = true
        and a.slug = app_slug
        and a.ativo = true
    )
    or exists (
      select 1
      from public.core_assinaturas s
      join public.core_apps a on a.id = s.app_id
      where s.empresa_id = public.current_empresa_id()
        and s.status in ('ativa', 'teste')
        and a.slug = app_slug
        and a.ativo = true
    );
$$;

grant execute on function public.get_current_usuario() to authenticated;
grant execute on function public.current_usuario_id() to authenticated;
grant execute on function public.current_usuario_tipo() to authenticated;
grant execute on function public.current_empresa_id() to authenticated;
grant execute on function public.is_admin_master() to authenticated;
grant execute on function public.can_access_app(text) to authenticated;

drop trigger if exists set_core_empresas_updated_at on public.core_empresas;
create trigger set_core_empresas_updated_at before update on public.core_empresas for each row execute function public.set_updated_at();
drop trigger if exists set_core_usuarios_updated_at on public.core_usuarios;
create trigger set_core_usuarios_updated_at before update on public.core_usuarios for each row execute function public.set_updated_at();
drop trigger if exists set_core_assinaturas_updated_at on public.core_assinaturas;
create trigger set_core_assinaturas_updated_at before update on public.core_assinaturas for each row execute function public.set_updated_at();
drop trigger if exists set_cot_produtos_updated_at on public.cot_produtos;
create trigger set_cot_produtos_updated_at before update on public.cot_produtos for each row execute function public.set_updated_at();
drop trigger if exists set_cot_vendedores_updated_at on public.cot_vendedores;
create trigger set_cot_vendedores_updated_at before update on public.cot_vendedores for each row execute function public.set_updated_at();
drop trigger if exists set_cot_cotacoes_updated_at on public.cot_cotacoes;
create trigger set_cot_cotacoes_updated_at before update on public.cot_cotacoes for each row execute function public.set_updated_at();
drop trigger if exists set_cot_pedidos_updated_at on public.cot_pedidos;
create trigger set_cot_pedidos_updated_at before update on public.cot_pedidos for each row execute function public.set_updated_at();
drop trigger if exists set_lava_clientes_updated_at on public.lava_clientes;
create trigger set_lava_clientes_updated_at before update on public.lava_clientes for each row execute function public.set_updated_at();
drop trigger if exists set_lava_veiculos_updated_at on public.lava_veiculos;
create trigger set_lava_veiculos_updated_at before update on public.lava_veiculos for each row execute function public.set_updated_at();
drop trigger if exists set_lava_funcionarios_updated_at on public.lava_funcionarios;
create trigger set_lava_funcionarios_updated_at before update on public.lava_funcionarios for each row execute function public.set_updated_at();
drop trigger if exists set_lava_servicos_updated_at on public.lava_servicos;
create trigger set_lava_servicos_updated_at before update on public.lava_servicos for each row execute function public.set_updated_at();
drop trigger if exists set_lava_lavagens_updated_at on public.lava_lavagens;
create trigger set_lava_lavagens_updated_at before update on public.lava_lavagens for each row execute function public.set_updated_at();

insert into public.core_apps (slug, nome, descricao, url_path, ativo, ordem)
values
  ('mba-cotacoes', 'MBA Cotacoes', 'Sistema de cotacoes, vendedores, respostas e pedidos.', '/cotacoes', true, 10),
  ('lavagestor', 'LavaGestor', 'Sistema para gestao de lava-jatos, lavagens, vales e comissoes.', '/lavagestor', true, 20)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  url_path = excluded.url_path,
  ativo = excluded.ativo,
  ordem = excluded.ordem;

create index if not exists idx_core_usuarios_auth_user_id on public.core_usuarios(auth_user_id);
create index if not exists idx_core_usuarios_empresa_id on public.core_usuarios(empresa_id);
create index if not exists idx_core_assinaturas_empresa_app on public.core_assinaturas(empresa_id, app_id, status);
create index if not exists idx_core_permissoes_usuario_app on public.core_permissoes(usuario_id, app_id);
create index if not exists idx_core_logs_empresa_created_at on public.core_logs(empresa_id, created_at desc);
create index if not exists idx_cot_produtos_empresa on public.cot_produtos(empresa_id);
create index if not exists idx_cot_vendedores_empresa on public.cot_vendedores(empresa_id);
create index if not exists idx_cot_cotacoes_empresa on public.cot_cotacoes(empresa_id, created_at desc);
create index if not exists idx_cot_itens_cotacao on public.cot_cotacao_itens(cotacao_id);
create index if not exists idx_cot_respostas_cotacao on public.cot_respostas(cotacao_id);
create index if not exists idx_cot_pedidos_empresa on public.cot_pedidos(empresa_id, created_at desc);
create index if not exists idx_lava_clientes_empresa on public.lava_clientes(empresa_id);
create index if not exists idx_lava_veiculos_empresa on public.lava_veiculos(empresa_id);
create index if not exists idx_lava_funcionarios_empresa on public.lava_funcionarios(empresa_id);
create index if not exists idx_lava_servicos_empresa on public.lava_servicos(empresa_id);
create index if not exists idx_lava_lavagens_empresa on public.lava_lavagens(empresa_id, data_lavagem desc);
create index if not exists idx_lava_comissoes_empresa on public.lava_comissoes(empresa_id);
create index if not exists idx_lava_vales_empresa on public.lava_vales(empresa_id);

alter table public.core_empresas enable row level security;
alter table public.core_usuarios enable row level security;
alter table public.core_apps enable row level security;
alter table public.core_planos enable row level security;
alter table public.core_assinaturas enable row level security;
alter table public.core_pagamentos enable row level security;
alter table public.core_permissoes enable row level security;
alter table public.core_logs enable row level security;
alter table public.cot_produtos enable row level security;
alter table public.cot_vendedores enable row level security;
alter table public.cot_cotacoes enable row level security;
alter table public.cot_cotacao_itens enable row level security;
alter table public.cot_respostas enable row level security;
alter table public.cot_pedidos enable row level security;
alter table public.cot_pedido_itens enable row level security;
alter table public.lava_clientes enable row level security;
alter table public.lava_veiculos enable row level security;
alter table public.lava_funcionarios enable row level security;
alter table public.lava_servicos enable row level security;
alter table public.lava_lavagens enable row level security;
alter table public.lava_comissoes enable row level security;
alter table public.lava_vales enable row level security;

drop policy if exists core_apps_public_select on public.core_apps;
create policy core_apps_public_select on public.core_apps
  for select to anon, authenticated
  using (ativo = true or public.is_admin_master());

drop policy if exists core_apps_master_manage on public.core_apps;
create policy core_apps_master_manage on public.core_apps
  for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

drop policy if exists core_empresas_select on public.core_empresas;
create policy core_empresas_select on public.core_empresas
  for select to authenticated
  using (public.is_admin_master() or id = public.current_empresa_id());

drop policy if exists core_empresas_insert on public.core_empresas;
create policy core_empresas_insert on public.core_empresas
  for insert to authenticated
  with check (public.is_admin_master());

drop policy if exists core_empresas_update on public.core_empresas;
create policy core_empresas_update on public.core_empresas
  for update to authenticated
  using (public.is_admin_master() or (id = public.current_empresa_id() and public.current_usuario_tipo() = 'admin_empresa'))
  with check (public.is_admin_master() or (id = public.current_empresa_id() and public.current_usuario_tipo() = 'admin_empresa'));

drop policy if exists core_usuarios_select on public.core_usuarios;
create policy core_usuarios_select on public.core_usuarios
  for select to authenticated
  using (public.is_admin_master() or empresa_id = public.current_empresa_id() or auth_user_id = auth.uid());

drop policy if exists core_usuarios_manage on public.core_usuarios;
create policy core_usuarios_manage on public.core_usuarios
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.current_usuario_tipo() = 'admin_empresa'))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.current_usuario_tipo() = 'admin_empresa'));

drop policy if exists core_planos_select on public.core_planos;
create policy core_planos_select on public.core_planos
  for select to authenticated
  using (ativo = true or public.is_admin_master());

drop policy if exists core_planos_master_manage on public.core_planos;
create policy core_planos_master_manage on public.core_planos
  for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

drop policy if exists core_assinaturas_select on public.core_assinaturas;
create policy core_assinaturas_select on public.core_assinaturas
  for select to authenticated
  using (public.is_admin_master() or empresa_id = public.current_empresa_id());

drop policy if exists core_assinaturas_master_manage on public.core_assinaturas;
create policy core_assinaturas_master_manage on public.core_assinaturas
  for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

drop policy if exists core_pagamentos_select on public.core_pagamentos;
create policy core_pagamentos_select on public.core_pagamentos
  for select to authenticated
  using (public.is_admin_master() or empresa_id = public.current_empresa_id());

drop policy if exists core_pagamentos_master_manage on public.core_pagamentos;
create policy core_pagamentos_master_manage on public.core_pagamentos
  for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

drop policy if exists core_permissoes_select on public.core_permissoes;
create policy core_permissoes_select on public.core_permissoes
  for select to authenticated
  using (
    public.is_admin_master()
    or exists (
      select 1 from public.core_usuarios u
      where u.id = usuario_id
        and u.empresa_id = public.current_empresa_id()
    )
  );

drop policy if exists core_permissoes_manage on public.core_permissoes;
create policy core_permissoes_manage on public.core_permissoes
  for all to authenticated
  using (
    public.is_admin_master()
    or (
      public.current_usuario_tipo() = 'admin_empresa'
      and exists (
        select 1 from public.core_usuarios u
        where u.id = usuario_id
          and u.empresa_id = public.current_empresa_id()
      )
    )
  )
  with check (
    public.is_admin_master()
    or (
      public.current_usuario_tipo() = 'admin_empresa'
      and exists (
        select 1 from public.core_usuarios u
        where u.id = usuario_id
          and u.empresa_id = public.current_empresa_id()
      )
    )
  );

drop policy if exists core_logs_select on public.core_logs;
create policy core_logs_select on public.core_logs
  for select to authenticated
  using (public.is_admin_master() or empresa_id = public.current_empresa_id());

drop policy if exists core_logs_insert on public.core_logs;
create policy core_logs_insert on public.core_logs
  for insert to authenticated
  with check (public.is_admin_master() or empresa_id = public.current_empresa_id());

drop policy if exists cot_produtos_company_access on public.cot_produtos;
create policy cot_produtos_company_access on public.cot_produtos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')));

drop policy if exists cot_vendedores_company_access on public.cot_vendedores;
create policy cot_vendedores_company_access on public.cot_vendedores
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')));

drop policy if exists cot_cotacoes_company_access on public.cot_cotacoes;
create policy cot_cotacoes_company_access on public.cot_cotacoes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')));

drop policy if exists cot_itens_company_access on public.cot_cotacao_itens;
create policy cot_itens_company_access on public.cot_cotacao_itens
  for all to authenticated
  using (
    public.is_admin_master()
    or exists (
      select 1 from public.cot_cotacoes c
      where c.id = cotacao_id
        and c.empresa_id = public.current_empresa_id()
        and public.can_access_app('mba-cotacoes')
    )
  )
  with check (
    public.is_admin_master()
    or exists (
      select 1 from public.cot_cotacoes c
      where c.id = cotacao_id
        and c.empresa_id = public.current_empresa_id()
        and public.can_access_app('mba-cotacoes')
    )
  );

drop policy if exists cot_respostas_company_access on public.cot_respostas;
create policy cot_respostas_company_access on public.cot_respostas
  for all to authenticated
  using (
    public.is_admin_master()
    or exists (
      select 1 from public.cot_cotacoes c
      where c.id = cotacao_id
        and c.empresa_id = public.current_empresa_id()
        and public.can_access_app('mba-cotacoes')
    )
  )
  with check (
    public.is_admin_master()
    or exists (
      select 1 from public.cot_cotacoes c
      where c.id = cotacao_id
        and c.empresa_id = public.current_empresa_id()
        and public.can_access_app('mba-cotacoes')
    )
  );

drop policy if exists cot_pedidos_company_access on public.cot_pedidos;
create policy cot_pedidos_company_access on public.cot_pedidos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('mba-cotacoes')));

drop policy if exists cot_pedido_itens_company_access on public.cot_pedido_itens;
create policy cot_pedido_itens_company_access on public.cot_pedido_itens
  for all to authenticated
  using (
    public.is_admin_master()
    or exists (
      select 1 from public.cot_pedidos p
      where p.id = pedido_id
        and p.empresa_id = public.current_empresa_id()
        and public.can_access_app('mba-cotacoes')
    )
  )
  with check (
    public.is_admin_master()
    or exists (
      select 1 from public.cot_pedidos p
      where p.id = pedido_id
        and p.empresa_id = public.current_empresa_id()
        and public.can_access_app('mba-cotacoes')
    )
  );

drop policy if exists lava_clientes_company_access on public.lava_clientes;
create policy lava_clientes_company_access on public.lava_clientes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_veiculos_company_access on public.lava_veiculos;
create policy lava_veiculos_company_access on public.lava_veiculos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_funcionarios_company_access on public.lava_funcionarios;
create policy lava_funcionarios_company_access on public.lava_funcionarios
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_servicos_company_access on public.lava_servicos;
create policy lava_servicos_company_access on public.lava_servicos
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_lavagens_company_access on public.lava_lavagens;
create policy lava_lavagens_company_access on public.lava_lavagens
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_comissoes_company_access on public.lava_comissoes;
create policy lava_comissoes_company_access on public.lava_comissoes
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));

drop policy if exists lava_vales_company_access on public.lava_vales;
create policy lava_vales_company_access on public.lava_vales
  for all to authenticated
  using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')))
  with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app('lavagestor')));
