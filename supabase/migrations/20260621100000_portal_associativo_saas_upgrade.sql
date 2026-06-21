create extension if not exists pgcrypto;

alter table public.assoc_configuracoes
  add column if not exists storage_provider_ativo text not null default 'nenhum' check (storage_provider_ativo in ('nenhum', 'manual', 'dropbox', 'google_drive')),
  add column if not exists assinatura_entidade text,
  add column if not exists implantacao_concluida boolean not null default false;

alter table public.assoc_configuracoes_pagamento
  add column if not exists descricao_padrao text,
  add column if not exists pix_preparado_automatico boolean not null default false;

alter table public.assoc_cobrancas
  add column if not exists valor_pago numeric(12,2),
  add column if not exists baixado_por uuid references public.core_usuarios(id) on delete set null,
  add column if not exists cancelado_por uuid references public.core_usuarios(id) on delete set null,
  add column if not exists cancelado_em timestamptz,
  add column if not exists motivo_cancelamento text,
  add column if not exists recibo_url text,
  add column if not exists recibo_file_id text,
  add column if not exists recibo_emitido_em timestamptz,
  add column if not exists recibo_metadados jsonb not null default '{}'::jsonb;

alter table public.assoc_reunioes
  add column if not exists local text,
  add column if not exists pauta text,
  add column if not exists ata text,
  add column if not exists anexos jsonb not null default '[]'::jsonb,
  add column if not exists liberado_associado boolean not null default false,
  add column if not exists decisoes text,
  add column if not exists ata_file_id text,
  add column if not exists ata_emitida_em timestamptz;

alter table public.assoc_avisos
  add column if not exists publico text not null default 'todos' check (publico in ('todos', 'perfil', 'status_cobranca', 'unidade')),
  add column if not exists perfis text[] not null default '{}'::text[],
  add column if not exists status_cobranca text,
  add column if not exists unidade_id uuid references public.assoc_unidades(id) on delete set null,
  add column if not exists link_portal text;

alter table public.assoc_projetos
  add column if not exists liberado_associado boolean not null default false,
  add column if not exists anexos jsonb not null default '[]'::jsonb,
  add column if not exists fotos jsonb not null default '[]'::jsonb,
  add column if not exists relatorio_url text;

create table if not exists public.assoc_storage_integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provedor text not null check (provedor in ('dropbox', 'google_drive')),
  status text not null default 'conectado' check (status in ('conectado', 'desconectado', 'erro')),
  account_email text,
  account_id text,
  root_folder_path text not null default '/Portal Associativo',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text,
  metadata jsonb not null default '{}'::jsonb,
  conectado_por uuid references public.core_usuarios(id) on delete set null,
  atualizado_por uuid references public.core_usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, provedor)
);

create table if not exists public.assoc_arquivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  pessoa_id uuid references public.assoc_pessoas(id) on delete set null,
  unidade_id uuid references public.assoc_unidades(id) on delete set null,
  cobranca_id uuid references public.assoc_cobrancas(id) on delete set null,
  reuniao_id uuid references public.assoc_reunioes(id) on delete set null,
  projeto_id uuid references public.assoc_projetos(id) on delete set null,
  provedor text not null check (provedor in ('dropbox', 'google_drive', 'manual')),
  file_id text,
  file_name text not null,
  mime_type text,
  size bigint,
  path text,
  shared_url text,
  visibility text not null default 'interno' check (visibility in ('interno', 'liberado_associado')),
  liberado_associado boolean not null default false,
  categoria text not null default 'documento',
  descricao text,
  criado_por uuid references public.core_usuarios(id) on delete set null,
  atualizado_por uuid references public.core_usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assoc_arquivos_vinculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  arquivo_id uuid not null references public.assoc_arquivos(id) on delete cascade,
  entidade text not null check (entidade in ('pessoa', 'unidade', 'cobranca', 'reuniao', 'projeto', 'transferencia')),
  entidade_id uuid not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.assoc_importacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  tipo text not null check (tipo in ('pessoas', 'unidades', 'cobrancas')),
  status text not null default 'processada' check (status in ('processada', 'erro')),
  total_linhas integer not null default 0,
  linhas_importadas integer not null default 0,
  erros jsonb not null default '[]'::jsonb,
  criado_por uuid references public.core_usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create unique index if not exists idx_assoc_cobrancas_mensalidade_unica
  on public.assoc_cobrancas(empresa_id, unidade_id, tipo_cobranca, mes_referencia, ano_referencia)
  where tipo_cobranca = 'mensalidade'
    and mes_referencia is not null
    and ano_referencia is not null
    and status <> 'cancelada';

create index if not exists idx_assoc_cobrancas_empresa_responsavel on public.assoc_cobrancas(empresa_id, pessoa_responsavel_id);
create index if not exists idx_assoc_cobrancas_empresa_referencia on public.assoc_cobrancas(empresa_id, tipo_cobranca, ano_referencia, mes_referencia);
create index if not exists idx_assoc_cobrancas_recibo on public.assoc_cobrancas(empresa_id, recibo_emitido_em) where recibo_emitido_em is not null;

create index if not exists idx_assoc_storage_integracoes_empresa_status on public.assoc_storage_integracoes(empresa_id, status);
create index if not exists idx_assoc_arquivos_empresa on public.assoc_arquivos(empresa_id, criado_em desc);
create index if not exists idx_assoc_arquivos_pessoa on public.assoc_arquivos(empresa_id, pessoa_id);
create index if not exists idx_assoc_arquivos_unidade on public.assoc_arquivos(empresa_id, unidade_id);
create index if not exists idx_assoc_arquivos_cobranca on public.assoc_arquivos(empresa_id, cobranca_id);
create index if not exists idx_assoc_arquivos_reuniao on public.assoc_arquivos(empresa_id, reuniao_id);
create index if not exists idx_assoc_arquivos_projeto on public.assoc_arquivos(empresa_id, projeto_id);
create index if not exists idx_assoc_arquivos_liberado on public.assoc_arquivos(empresa_id, liberado_associado);
create index if not exists idx_assoc_arquivos_categoria on public.assoc_arquivos(empresa_id, categoria);
create index if not exists idx_assoc_arquivos_vinculos_empresa on public.assoc_arquivos_vinculos(empresa_id, entidade, entidade_id);
create index if not exists idx_assoc_importacoes_empresa on public.assoc_importacoes(empresa_id, criado_em desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assoc_storage_integracoes',
    'assoc_arquivos',
    'assoc_arquivos_vinculos',
    'assoc_importacoes'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_empresa_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app(''portal-associativo''))) with check (public.is_admin_master() or (empresa_id = public.current_empresa_id() and public.can_access_app(''portal-associativo'')))',
      table_name || '_empresa_access',
      table_name
    );
  end loop;
end $$;
