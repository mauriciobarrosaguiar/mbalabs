create extension if not exists pgcrypto;

insert into public.core_empresa_categorias (nome, slug, descricao, status)
values
  ('Gestao', 'gestao', 'Empresas e entidades que precisam gerir operacoes associativas.', 'ativa')
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  status = excluded.status,
  updated_at = now();

insert into public.core_apps (slug, nome, descricao, url_path, url_interna, url_externa, logo_icone, status, ativo, ordem)
values (
  'portal-associativo',
  'Portal Associativo',
  'Gestao completa para associacoes, associados, unidades, cobrancas, reunioes, avisos, documentos e projetos.',
  '/portal-associativo',
  '/portal-associativo',
  null,
  'PA',
  'ativo',
  true,
  50
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

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Essencial', 'Plano inicial para entidades organizarem cadastros, unidades e cobrancas.', 0, 5, 2000, true
from public.core_apps
where slug = 'portal-associativo'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;

insert into public.core_planos (app_id, nome, descricao, valor_mensal, limite_usuarios, limite_registros, ativo)
select id, 'Profissional', 'Plano para entidades com financeiro, documentos, projetos e comunicados em escala.', 129.90, 25, 50000, true
from public.core_apps
where slug = 'portal-associativo'
on conflict (app_id, nome) do update set
  descricao = excluded.descricao,
  valor_mensal = excluded.valor_mensal,
  limite_usuarios = excluded.limite_usuarios,
  limite_registros = excluded.limite_registros,
  ativo = excluded.ativo;

create table if not exists public.assoc_configuracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome_publico_entidade text not null default 'Portal Associativo',
  subtitulo text not null default 'Gestao integrada de associados, unidades, cobrancas e comunicados.',
  logo_url text,
  tema_visual text not null default 'padrao',
  tipo_unidade_padrao text not null default 'propriedade',
  valor_mensalidade_padrao numeric(12,2) not null default 0,
  vencimento_padrao integer not null default 10 check (vencimento_padrao between 1 and 31),
  descricao_mensalidade_padrao text not null default 'Mensalidade',
  pix_chave text,
  pix_tipo_chave text,
  recebedor_nome text,
  recebedor_cidade text,
  webhook_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id)
);

create table if not exists public.assoc_pessoas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  core_usuario_id uuid references public.core_usuarios(id) on delete set null,
  nome_completo text not null,
  tipo_pessoa text not null default 'fisica' check (tipo_pessoa in ('fisica', 'juridica')),
  cpf_cnpj text,
  rg_ie text,
  telefone text,
  whatsapp text,
  email text,
  endereco_residencial text,
  cidade text,
  uf text,
  status_pessoa text not null default 'ativa' check (status_pessoa in ('ativa', 'inativa', 'antigo_proprietario')),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assoc_perfis_usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  core_usuario_id uuid not null references public.core_usuarios(id) on delete cascade,
  pessoa_id uuid references public.assoc_pessoas(id) on delete set null,
  perfil text not null check (perfil in ('administrador', 'presidente', 'tesoureiro', 'secretario', 'conselho_fiscal', 'associado', 'portaria')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, core_usuario_id)
);

create table if not exists public.assoc_unidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  codigo_unidade text not null,
  numero_unidade text not null,
  quadra_setor text,
  tipo_unidade text not null default 'propriedade' check (tipo_unidade in ('chacara', 'lote', 'casa', 'sala', 'box', 'propriedade', 'outro')),
  endereco_localizacao text,
  area_m2 numeric(12,2),
  coordenadas_maps text,
  status_unidade text not null default 'ativa' check (status_unidade in ('ativa', 'inativa', 'bloqueada')),
  possui_construcao boolean not null default false,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, codigo_unidade)
);

create table if not exists public.assoc_vinculos_unidade_pessoa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  unidade_id uuid not null references public.assoc_unidades(id) on delete cascade,
  pessoa_id uuid not null references public.assoc_pessoas(id) on delete cascade,
  tipo_vinculo text not null check (tipo_vinculo in ('proprietario', 'responsavel_financeiro', 'responsavel_contato', 'morador', 'autorizado', 'outro')),
  data_inicio date not null default current_date,
  data_fim date,
  status_vinculo text not null default 'ativo' check (status_vinculo in ('ativo', 'encerrado', 'suspenso')),
  motivo_encerramento text,
  documento_url text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assoc_cobrancas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  unidade_id uuid not null references public.assoc_unidades(id) on delete cascade,
  pessoa_responsavel_id uuid references public.assoc_pessoas(id) on delete set null,
  tipo_cobranca text not null default 'mensalidade',
  descricao text not null default 'Mensalidade',
  mes_referencia integer check (mes_referencia between 1 and 12),
  ano_referencia integer check (ano_referencia between 2000 and 2100),
  data_vencimento date not null,
  valor_original numeric(12,2) not null default 0,
  valor_juros numeric(12,2) not null default 0,
  valor_multa numeric(12,2) not null default 0,
  valor_desconto numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  status text not null default 'aberta' check (status in ('aberta', 'aguardando_pagamento', 'vencida', 'negociada', 'paga', 'cancelada')),
  forma_pagamento text,
  pix_txid text,
  pix_qrcode text,
  pix_copia_cola text,
  pix_gateway text check (pix_gateway is null or pix_gateway in ('manual', 'efi', 'banco_brasil')),
  data_pagamento timestamptz,
  comprovante_url text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assoc_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  unidade_id uuid references public.assoc_unidades(id) on delete cascade,
  pessoa_id uuid references public.assoc_pessoas(id) on delete set null,
  titulo text not null,
  categoria text not null default 'documento',
  descricao text,
  storage_bucket text not null default 'portal-associativo',
  storage_path text not null,
  mime_type text,
  tamanho_bytes bigint,
  liberado_associado boolean not null default false,
  criado_por uuid references public.core_usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.assoc_transferencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  unidade_id uuid not null references public.assoc_unidades(id) on delete cascade,
  pessoa_anterior_id uuid references public.assoc_pessoas(id) on delete set null,
  nova_pessoa_id uuid not null references public.assoc_pessoas(id) on delete cascade,
  responsavel_financeiro_id uuid references public.assoc_pessoas(id) on delete set null,
  responsavel_contato_id uuid references public.assoc_pessoas(id) on delete set null,
  data_transferencia date not null default current_date,
  motivo text not null,
  documento_url text,
  responsabilidade_debitos text not null check (responsabilidade_debitos in ('anterior', 'novo', 'dividida', 'entidade')),
  observacoes text,
  criado_por uuid references public.core_usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.assoc_reunioes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  titulo text not null,
  data_reuniao timestamptz not null,
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  descricao text,
  ata_url text,
  presencas jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assoc_avisos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  visivel_de date not null default current_date,
  visivel_ate date,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  mostrar_painel boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assoc_projetos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  status text not null default 'planejado' check (status in ('planejado', 'andamento', 'concluido')),
  valor_previsto numeric(12,2) not null default 0,
  valor_arrecadado numeric(12,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assoc_configuracoes_pagamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provedor_pix_ativo text not null default 'manual' check (provedor_pix_ativo in ('manual', 'efi', 'banco_brasil')),
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  chave_pix text,
  nome_recebedor text,
  cidade_recebedor text,
  webhook_url text,
  modo_cobranca_padrao text not null default 'manual',
  gerar_pix_automatico boolean not null default false,
  status_configuracao text not null default 'nao_testado',
  atualizado_por uuid references public.core_usuarios(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  unique (empresa_id)
);

create table if not exists public.assoc_segredos_pagamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  provider text not null check (provider in ('efi', 'banco_brasil')),
  secret_key text not null,
  secret_value_encrypted text not null,
  metadata jsonb not null default '{}'::jsonb,
  atualizado_por uuid references public.core_usuarios(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, provider, secret_key)
);

create table if not exists public.assoc_auditoria_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.core_empresas(id) on delete cascade,
  usuario_id uuid references public.core_usuarios(id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_assoc_pessoas_empresa_nome on public.assoc_pessoas(empresa_id, nome_completo);
create index if not exists idx_assoc_pessoas_empresa_status on public.assoc_pessoas(empresa_id, status_pessoa);
create unique index if not exists idx_assoc_pessoas_empresa_cpf_cnpj on public.assoc_pessoas(empresa_id, cpf_cnpj) where cpf_cnpj is not null and cpf_cnpj <> '';
create unique index if not exists idx_assoc_pessoas_empresa_email on public.assoc_pessoas(empresa_id, lower(email)) where email is not null and email <> '';
create unique index if not exists idx_assoc_pessoas_empresa_telefone on public.assoc_pessoas(empresa_id, telefone) where telefone is not null and telefone <> '';
create unique index if not exists idx_assoc_pessoas_empresa_whatsapp on public.assoc_pessoas(empresa_id, whatsapp) where whatsapp is not null and whatsapp <> '';

create index if not exists idx_assoc_perfis_empresa_usuario on public.assoc_perfis_usuarios(empresa_id, core_usuario_id);
create index if not exists idx_assoc_unidades_empresa_status on public.assoc_unidades(empresa_id, status_unidade);
create index if not exists idx_assoc_vinculos_empresa_unidade on public.assoc_vinculos_unidade_pessoa(empresa_id, unidade_id);
create index if not exists idx_assoc_vinculos_empresa_pessoa on public.assoc_vinculos_unidade_pessoa(empresa_id, pessoa_id);
create unique index if not exists idx_assoc_vinculo_proprietario_ativo on public.assoc_vinculos_unidade_pessoa(empresa_id, unidade_id)
  where tipo_vinculo = 'proprietario' and status_vinculo = 'ativo' and data_fim is null;
create unique index if not exists idx_assoc_vinculo_financeiro_ativo on public.assoc_vinculos_unidade_pessoa(empresa_id, unidade_id)
  where tipo_vinculo = 'responsavel_financeiro' and status_vinculo = 'ativo' and data_fim is null;
create unique index if not exists idx_assoc_vinculo_contato_ativo on public.assoc_vinculos_unidade_pessoa(empresa_id, unidade_id)
  where tipo_vinculo = 'responsavel_contato' and status_vinculo = 'ativo' and data_fim is null;

create index if not exists idx_assoc_cobrancas_empresa_status on public.assoc_cobrancas(empresa_id, status);
create index if not exists idx_assoc_cobrancas_empresa_vencimento on public.assoc_cobrancas(empresa_id, data_vencimento);
create index if not exists idx_assoc_cobrancas_unidade on public.assoc_cobrancas(unidade_id);
create index if not exists idx_assoc_documentos_empresa on public.assoc_documentos(empresa_id, categoria);
create index if not exists idx_assoc_transferencias_empresa on public.assoc_transferencias(empresa_id, data_transferencia desc);
create index if not exists idx_assoc_reunioes_empresa_data on public.assoc_reunioes(empresa_id, data_reuniao desc);
create index if not exists idx_assoc_avisos_empresa_visibilidade on public.assoc_avisos(empresa_id, status, visivel_de, visivel_ate);
create index if not exists idx_assoc_projetos_empresa_status on public.assoc_projetos(empresa_id, status);
create index if not exists idx_assoc_auditoria_empresa_entidade on public.assoc_auditoria_logs(empresa_id, entidade, entidade_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assoc_configuracoes',
    'assoc_pessoas',
    'assoc_perfis_usuarios',
    'assoc_unidades',
    'assoc_vinculos_unidade_pessoa',
    'assoc_cobrancas',
    'assoc_documentos',
    'assoc_transferencias',
    'assoc_reunioes',
    'assoc_avisos',
    'assoc_projetos',
    'assoc_configuracoes_pagamento',
    'assoc_segredos_pagamento',
    'assoc_auditoria_logs'
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

insert into storage.buckets (id, name, public)
values ('portal-associativo', 'portal-associativo', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

drop policy if exists portal_associativo_storage_select on storage.objects;
create policy portal_associativo_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'portal-associativo'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('portal-associativo'))
    )
  );

drop policy if exists portal_associativo_storage_insert on storage.objects;
create policy portal_associativo_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portal-associativo'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('portal-associativo'))
    )
  );

drop policy if exists portal_associativo_storage_update on storage.objects;
create policy portal_associativo_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'portal-associativo'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('portal-associativo'))
    )
  )
  with check (
    bucket_id = 'portal-associativo'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('portal-associativo'))
    )
  );

drop policy if exists portal_associativo_storage_delete on storage.objects;
create policy portal_associativo_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portal-associativo'
    and (
      public.is_admin_master()
      or ((storage.foldername(name))[1] = public.current_empresa_id()::text and public.can_access_app('portal-associativo'))
    )
  );
