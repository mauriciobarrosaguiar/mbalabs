create table if not exists public.gmb_empresas (
  id uuid primary key default gen_random_uuid(),
  criado_por uuid references public.core_usuarios(id) on delete set null,
  nome text not null,
  razao_social text,
  cnpj text,
  categoria_principal text not null,
  google_categoria_id text,
  google_categoria_nome text,
  categorias_secundarias text[] not null default '{}',
  tipo_atendimento text not null default 'local' check (tipo_atendimento in ('local', 'area_servico', 'hibrido')),
  endereco_linha1 text,
  endereco_linha2 text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  pais text not null default 'BR',
  areas_atendimento text[] not null default '{}',
  telefone text,
  whatsapp text,
  email_cliente text,
  site text,
  descricao text,
  data_abertura date,
  horario_regular jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (
    status in (
      'rascunho',
      'aguardando_cliente',
      'autorizado',
      'pronto_criacao',
      'criado',
      'aguardando_verificacao',
      'verificado',
      'erro',
      'arquivado'
    )
  ),
  google_account_name text,
  google_location_name text,
  google_place_id text,
  google_maps_uri text,
  google_verification_name text,
  verification_options jsonb not null default '[]'::jsonb,
  google_status jsonb not null default '{}'::jsonb,
  ultimo_erro text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmb_autorizacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.gmb_empresas(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  email_cliente text,
  status text not null default 'pendente' check (status in ('pendente', 'autorizado', 'expirado', 'revogado', 'erro')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  autorizado_em timestamptz,
  revogado_em timestamptz,
  google_email text,
  google_subject text,
  google_accounts jsonb not null default '[]'::jsonb,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  oauth_state text unique,
  oauth_state_expires_at timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmb_operacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.gmb_empresas(id) on delete cascade,
  autorizacao_id uuid references public.gmb_autorizacoes(id) on delete set null,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  tipo text not null,
  status text not null default 'sucesso' check (status in ('sucesso', 'erro', 'pendente')),
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_gmb_empresas_status on public.gmb_empresas(status, updated_at desc);
create index if not exists idx_gmb_empresas_nome on public.gmb_empresas(nome);
create index if not exists idx_gmb_autorizacoes_empresa on public.gmb_autorizacoes(empresa_id, created_at desc);
create index if not exists idx_gmb_autorizacoes_token on public.gmb_autorizacoes(public_token);
create index if not exists idx_gmb_operacoes_empresa on public.gmb_operacoes(empresa_id, created_at desc);

drop trigger if exists set_gmb_empresas_updated_at on public.gmb_empresas;
create trigger set_gmb_empresas_updated_at
before update on public.gmb_empresas
for each row execute function public.set_updated_at();

drop trigger if exists set_gmb_autorizacoes_updated_at on public.gmb_autorizacoes;
create trigger set_gmb_autorizacoes_updated_at
before update on public.gmb_autorizacoes
for each row execute function public.set_updated_at();

alter table public.gmb_empresas enable row level security;
alter table public.gmb_autorizacoes enable row level security;
alter table public.gmb_operacoes enable row level security;

drop policy if exists gmb_empresas_admin_master on public.gmb_empresas;
create policy gmb_empresas_admin_master on public.gmb_empresas
  for all to authenticated
  using (public.current_usuario_tipo() in ('admin_master', 'super_admin'))
  with check (public.current_usuario_tipo() in ('admin_master', 'super_admin'));

drop policy if exists gmb_autorizacoes_admin_master on public.gmb_autorizacoes;
create policy gmb_autorizacoes_admin_master on public.gmb_autorizacoes
  for all to authenticated
  using (public.current_usuario_tipo() in ('admin_master', 'super_admin'))
  with check (public.current_usuario_tipo() in ('admin_master', 'super_admin'));

drop policy if exists gmb_operacoes_admin_master on public.gmb_operacoes;
create policy gmb_operacoes_admin_master on public.gmb_operacoes
  for all to authenticated
  using (public.current_usuario_tipo() in ('admin_master', 'super_admin'))
  with check (public.current_usuario_tipo() in ('admin_master', 'super_admin'));

grant select, insert, update, delete on public.gmb_empresas to authenticated;
grant select, insert, update, delete on public.gmb_autorizacoes to authenticated;
grant select, insert, update, delete on public.gmb_operacoes to authenticated;
