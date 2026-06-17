-- LexGestor schema inicial.
-- ATENCAO: arquivo preparado para revisao. Nao aplicar automaticamente.
-- Todas as tabelas novas usam prefixo lex_ e nao alteram tabelas core_ do MBA Labs.

create extension if not exists pgcrypto;

create table if not exists public.lex_escritorios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid null,
  nome text not null,
  cnpj text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  logo_url text,
  watermark_text text,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_advogados (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  core_usuario_id uuid null,
  nome text not null,
  oab text,
  uf_oab text,
  email text,
  telefone text,
  cargo text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_clientes (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  nome text not null,
  cpf_cnpj text,
  rg text,
  data_nascimento date null,
  estado_civil text,
  profissao text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  observacoes text,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_casos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  cliente_id uuid not null references public.lex_clientes(id) on delete cascade,
  advogado_responsavel_id uuid references public.lex_advogados(id) on delete set null,
  area text not null,
  subarea text not null,
  titulo text not null,
  numero_processo text,
  vara text,
  comarca text,
  status text not null default 'Em atendimento',
  prioridade text not null default 'Normal',
  segredo_justica boolean not null default false,
  relato_inicial text,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_relatos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  caso_id uuid not null references public.lex_casos(id) on delete cascade,
  cliente_id uuid not null references public.lex_clientes(id) on delete cascade,
  origem text not null default 'manual',
  titulo text,
  conteudo text not null,
  criado_por uuid null,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  subarea text not null,
  titulo text not null,
  descricao text,
  documentos_necessarios jsonb not null default '[]'::jsonb,
  obrigatorio boolean not null default true,
  ordem integer not null default 1,
  ativo boolean not null default true
);

create table if not exists public.lex_documentos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  cliente_id uuid not null references public.lex_clientes(id) on delete cascade,
  caso_id uuid not null references public.lex_casos(id) on delete cascade,
  checklist_item_id uuid null references public.lex_checklist_templates(id) on delete set null,
  nome_original text not null,
  nome_arquivo_sistema text,
  tipo_documento text,
  mime_type text,
  tamanho_bytes bigint,
  dropbox_path_original text,
  dropbox_path_pdf_marca_dagua text,
  dropbox_path_dossie_final text,
  possui_marca_dagua boolean not null default false,
  hash_sha256 text,
  status text not null default 'metadados_criados',
  criado_por uuid null,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_checklist_respostas (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  caso_id uuid not null references public.lex_casos(id) on delete cascade,
  checklist_template_id uuid not null references public.lex_checklist_templates(id) on delete restrict,
  status text not null default 'pendente',
  observacao text,
  documento_id uuid null references public.lex_documentos(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.lex_dropbox_conexoes (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  dropbox_account_id text,
  dropbox_email text,
  root_folder_path text not null default '/LexGestor',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  status text not null default 'nao_conectado',
  conectado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.lex_whatsapp_conversas (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  cliente_id uuid not null references public.lex_clientes(id) on delete cascade,
  caso_id uuid null references public.lex_casos(id) on delete set null,
  telefone text,
  status text not null default 'manual',
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  conversa_id uuid not null references public.lex_whatsapp_conversas(id) on delete cascade,
  cliente_id uuid not null references public.lex_clientes(id) on delete cascade,
  caso_id uuid null references public.lex_casos(id) on delete set null,
  origem text not null default 'manual',
  conteudo text,
  tipo text not null default 'texto',
  anexo_dropbox_path text,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_tarefas (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  caso_id uuid null references public.lex_casos(id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'pendente',
  prioridade text not null default 'Normal',
  vencimento timestamptz null,
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_prazos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  caso_id uuid not null references public.lex_casos(id) on delete cascade,
  titulo text not null,
  descricao text,
  data_prazo timestamptz not null,
  status text not null default 'pendente',
  criado_em timestamptz not null default now()
);

create table if not exists public.lex_auditoria (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  usuario_id uuid null,
  acao text not null,
  entidade text not null,
  entidade_id uuid null,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists lex_advogados_escritorio_idx on public.lex_advogados(escritorio_id);
create index if not exists lex_clientes_escritorio_idx on public.lex_clientes(escritorio_id);
create index if not exists lex_casos_escritorio_idx on public.lex_casos(escritorio_id);
create index if not exists lex_casos_cliente_idx on public.lex_casos(cliente_id);
create index if not exists lex_documentos_escritorio_idx on public.lex_documentos(escritorio_id);
create index if not exists lex_documentos_caso_idx on public.lex_documentos(caso_id);
create index if not exists lex_checklist_templates_area_idx on public.lex_checklist_templates(area, subarea);
create index if not exists lex_checklist_respostas_caso_idx on public.lex_checklist_respostas(caso_id);
create index if not exists lex_dropbox_conexoes_escritorio_idx on public.lex_dropbox_conexoes(escritorio_id);
create index if not exists lex_whatsapp_conversas_cliente_idx on public.lex_whatsapp_conversas(cliente_id);
create index if not exists lex_whatsapp_mensagens_conversa_idx on public.lex_whatsapp_mensagens(conversa_id);
create index if not exists lex_tarefas_caso_idx on public.lex_tarefas(caso_id);
create index if not exists lex_prazos_caso_idx on public.lex_prazos(caso_id);

create unique index if not exists lex_checklist_templates_unique_idx
  on public.lex_checklist_templates(area, subarea, ordem);
