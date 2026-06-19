-- LexGestor: processos eproc/DataJud e documentos vinculados.
-- Escopo restrito a public.lex_*.

create extension if not exists pgcrypto;

create table if not exists public.lex_tribunais (
  id uuid primary key default gen_random_uuid(),
  nome text,
  sigla text,
  alias_datajud text,
  segmento text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists lex_tribunais_sigla_unique_idx
  on public.lex_tribunais(sigla)
  where sigla is not null;

insert into public.lex_tribunais (nome, sigla, alias_datajud, segmento, ativo)
values
  ('Tribunal de Justica do Tocantins', 'TJTO', 'api_publica_tjto', 'estadual', true),
  ('Tribunal Regional Federal da 1 Regiao', 'TRF1', 'api_publica_trf1', 'federal', true),
  ('Tribunal Regional Federal da 2 Regiao', 'TRF2', 'api_publica_trf2', 'federal', true),
  ('Tribunal Regional Federal da 3 Regiao', 'TRF3', 'api_publica_trf3', 'federal', true),
  ('Tribunal Regional Federal da 4 Regiao', 'TRF4', 'api_publica_trf4', 'federal', true),
  ('Tribunal Regional Federal da 5 Regiao', 'TRF5', 'api_publica_trf5', 'federal', true),
  ('Tribunal Regional Federal da 6 Regiao', 'TRF6', 'api_publica_trf6', 'federal', true),
  ('Tribunal Regional do Trabalho da 10 Regiao', 'TRT10', 'api_publica_trt10', 'trabalhista', true),
  ('Superior Tribunal de Justica', 'STJ', 'api_publica_stj', 'superior', true)
on conflict (sigla) do update
set
  nome = excluded.nome,
  alias_datajud = excluded.alias_datajud,
  segmento = excluded.segmento,
  ativo = excluded.ativo;

create table if not exists public.lex_processos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  escritorio_id uuid references public.lex_escritorios(id) on delete cascade,
  advogado_id uuid references public.lex_advogados(id) on delete set null,
  cliente_id uuid references public.lex_clientes(id) on delete set null,
  caso_id uuid references public.lex_casos(id) on delete set null,
  numero_cnj text not null,
  numero_cnj_limpo text not null,
  tribunal text,
  tribunal_alias_datajud text,
  grau text,
  classe_codigo text,
  classe_nome text,
  sistema_nome text,
  formato_nome text,
  orgao_julgador_nome text,
  orgao_julgador_codigo text,
  data_ajuizamento timestamptz,
  data_ultima_atualizacao_datajud timestamptz,
  nivel_sigilo int,
  segredo_justica boolean not null default false,
  chave_eproc_opcional text,
  url_eproc text,
  categoria text,
  subcategoria text,
  status text not null default 'ativo',
  observacoes text,
  raw_json jsonb,
  possui_nova_movimentacao boolean not null default false,
  ultima_sincronizacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lex_processos_escritorio_numero_unique_idx
  on public.lex_processos(escritorio_id, numero_cnj_limpo)
  where escritorio_id is not null;

create index if not exists lex_processos_escritorio_idx on public.lex_processos(escritorio_id);
create index if not exists lex_processos_cliente_idx on public.lex_processos(cliente_id);
create index if not exists lex_processos_caso_idx on public.lex_processos(caso_id);
create index if not exists lex_processos_numero_idx on public.lex_processos(numero_cnj_limpo);

create table if not exists public.lex_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.lex_processos(id) on delete cascade,
  empresa_id uuid,
  escritorio_id uuid references public.lex_escritorios(id) on delete cascade,
  advogado_id uuid references public.lex_advogados(id) on delete set null,
  cliente_id uuid references public.lex_clientes(id) on delete set null,
  caso_id uuid references public.lex_casos(id) on delete set null,
  codigo_movimento text,
  nome_movimento text,
  descricao text,
  evento_numero text,
  data_movimento timestamptz,
  hash_movimento text,
  raw_json jsonb,
  tem_documento boolean not null default false,
  documento_status text not null default 'sem_documento',
  visualizado boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists lex_movimentacoes_hash_unique_idx
  on public.lex_movimentacoes(hash_movimento)
  where hash_movimento is not null;

create index if not exists lex_movimentacoes_processo_data_idx
  on public.lex_movimentacoes(processo_id, data_movimento desc);
create index if not exists lex_movimentacoes_escritorio_idx on public.lex_movimentacoes(escritorio_id);
create index if not exists lex_movimentacoes_cliente_idx on public.lex_movimentacoes(cliente_id);
create index if not exists lex_movimentacoes_caso_idx on public.lex_movimentacoes(caso_id);

create table if not exists public.lex_logs_integracao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  escritorio_id uuid references public.lex_escritorios(id) on delete cascade,
  usuario_id uuid,
  processo_id uuid references public.lex_processos(id) on delete set null,
  documento_id uuid references public.lex_documentos(id) on delete set null,
  acao text,
  status text,
  erro text,
  detalhes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lex_logs_integracao_escritorio_idx on public.lex_logs_integracao(escritorio_id);
create index if not exists lex_logs_integracao_processo_idx on public.lex_logs_integracao(processo_id);
create index if not exists lex_logs_integracao_documento_idx on public.lex_logs_integracao(documento_id);

alter table if exists public.lex_documentos
  add column if not exists empresa_id uuid,
  add column if not exists advogado_id uuid references public.lex_advogados(id) on delete set null,
  add column if not exists processo_id uuid references public.lex_processos(id) on delete set null,
  add column if not exists movimentacao_id uuid references public.lex_movimentacoes(id) on delete set null,
  add column if not exists nome_documento text,
  add column if not exists nome_storage text,
  add column if not exists categoria text,
  add column if not exists subcategoria text,
  add column if not exists provider text,
  add column if not exists caminho_original text,
  add column if not exists caminho_pdf text,
  add column if not exists dropbox_file_id text,
  add column if not exists dropbox_folder_path text,
  add column if not exists hash_arquivo text,
  add column if not exists enviado_por uuid,
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists excluido_em timestamptz;

create index if not exists lex_documentos_processo_idx on public.lex_documentos(processo_id);
create index if not exists lex_documentos_movimentacao_idx on public.lex_documentos(movimentacao_id);
create index if not exists lex_documentos_status_idx on public.lex_documentos(escritorio_id, status);

alter table public.lex_tribunais enable row level security;
alter table public.lex_processos enable row level security;
alter table public.lex_movimentacoes enable row level security;
alter table public.lex_logs_integracao enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lex_tribunais' and policyname = 'lex_tribunais_select_autenticado'
  ) then
    create policy "lex_tribunais_select_autenticado"
    on public.lex_tribunais
    for select
    to authenticated
    using (ativo = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lex_processos' and policyname = 'lex_processos_isolamento_escritorio'
  ) then
    create policy "lex_processos_isolamento_escritorio"
    on public.lex_processos
    for all
    using (escritorio_id = public.lex_current_escritorio_id())
    with check (escritorio_id = public.lex_current_escritorio_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lex_movimentacoes' and policyname = 'lex_movimentacoes_isolamento_escritorio'
  ) then
    create policy "lex_movimentacoes_isolamento_escritorio"
    on public.lex_movimentacoes
    for all
    using (escritorio_id = public.lex_current_escritorio_id())
    with check (escritorio_id = public.lex_current_escritorio_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lex_logs_integracao' and policyname = 'lex_logs_integracao_select_mesmo_escritorio'
  ) then
    create policy "lex_logs_integracao_select_mesmo_escritorio"
    on public.lex_logs_integracao
    for select
    using (escritorio_id = public.lex_current_escritorio_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lex_logs_integracao' and policyname = 'lex_logs_integracao_insert_mesmo_escritorio'
  ) then
    create policy "lex_logs_integracao_insert_mesmo_escritorio"
    on public.lex_logs_integracao
    for insert
    with check (escritorio_id = public.lex_current_escritorio_id());
  end if;
end $$;
