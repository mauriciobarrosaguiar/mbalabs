-- MBA Escola no Supabase central da MBA Labs
-- Uma única autenticação (auth.uid() da MBA Labs), sem login de aluno e sem chamada diária.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabelas canônicas do produto atual
-- ---------------------------------------------------------------------------
create table if not exists public.escola_escolas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  status text not null default 'teste',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  papel text not null,
  ativo boolean not null default true,
  is_teste boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_turmas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  nome text not null,
  ano_letivo integer not null default extract(year from now())::integer,
  turno text not null default 'matutino',
  professor_responsavel_id uuid references public.escola_perfis(id) on delete set null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_alunos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid references public.escola_turmas(id) on delete set null,
  nome text not null,
  data_nascimento date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_aluno_responsaveis (
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  responsavel_id uuid not null references public.escola_perfis(id) on delete cascade,
  parentesco text,
  principal boolean not null default false,
  autorizado_buscar boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (aluno_id, responsavel_id)
);

create table if not exists public.escola_convites (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null,
  aluno_id uuid references public.escola_alunos(id) on delete set null,
  status text not null default 'pendente',
  expira_em timestamptz not null default (now() + interval '14 days'),
  aceito_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_disciplinas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  nome text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_professor_alocacoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  professor_id uuid not null references public.escola_perfis(id) on delete cascade,
  turma_id uuid not null references public.escola_turmas(id) on delete cascade,
  disciplina_id uuid not null references public.escola_disciplinas(id) on delete cascade,
  tipo_alocacao text not null default 'disciplina',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (professor_id, turma_id, disciplina_id)
);

create table if not exists public.escola_grade_horarios (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid not null references public.escola_turmas(id) on delete cascade,
  professor_id uuid not null references public.escola_perfis(id) on delete cascade,
  disciplina_id uuid not null references public.escola_disciplinas(id) on delete cascade,
  dia_semana integer not null,
  hora_inicio time not null,
  hora_fim time not null,
  sala text,
  ano_letivo integer not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_atividades (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid not null references public.escola_turmas(id) on delete cascade,
  professor_id uuid not null references public.escola_perfis(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  data_entrega date,
  status text not null default 'publicada',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_atividade_entregas (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.escola_atividades(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  situacao text not null default 'pendente',
  entregue_em timestamptz,
  comentario_professor text,
  atualizado_em timestamptz not null default now(),
  unique (atividade_id, aluno_id)
);

create table if not exists public.escola_acompanhamentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete restrict,
  categoria text not null default 'pedagogico',
  titulo text not null,
  observacao text not null,
  acao_planejada text,
  prazo date,
  status text not null default 'aberto',
  visivel_responsavel boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_reunioes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid references public.escola_alunos(id) on delete set null,
  responsavel_id uuid references public.escola_perfis(id) on delete set null,
  criado_por uuid not null references auth.users(id) on delete restrict,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz,
  local text,
  pauta text,
  status text not null default 'agendada',
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_comunicados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid references public.escola_turmas(id) on delete set null,
  autor_id uuid not null references auth.users(id) on delete restrict,
  titulo text not null,
  resumo text,
  conteudo text not null,
  prioridade text not null default 'normal',
  exige_confirmacao boolean not null default false,
  status text not null default 'publicado',
  publicado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_comunicado_leituras (
  comunicado_id uuid not null references public.escola_comunicados(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  lido_em timestamptz not null default now(),
  confirmado_em timestamptz,
  primary key (comunicado_id, usuario_id)
);

create table if not exists public.escola_frequencias (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  grade_id uuid references public.escola_grade_horarios(id) on delete set null,
  turma_id uuid references public.escola_turmas(id) on delete set null,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  data_aula date not null,
  status text not null default 'falta',
  observacao text,
  registrado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_justificativas_falta (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  frequencia_id uuid not null references public.escola_frequencias(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  responsavel_id uuid not null references public.escola_perfis(id) on delete cascade,
  motivo text not null,
  descricao text,
  status text not null default 'pendente',
  observacao_analise text,
  analisado_por uuid references auth.users(id) on delete set null,
  analisado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (frequencia_id, responsavel_id)
);

create table if not exists public.escola_justificativa_arquivos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  justificativa_id uuid not null references public.escola_justificativas_falta(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  responsavel_id uuid not null references public.escola_perfis(id) on delete cascade,
  storage_path text not null,
  nome_arquivo text not null,
  mime_type text,
  tamanho bigint,
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_intercorrencias_grade (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  grade_id uuid references public.escola_grade_horarios(id) on delete set null,
  turma_id uuid not null references public.escola_turmas(id) on delete cascade,
  tipo text not null,
  data_evento date not null,
  novo_horario_saida time,
  motivo text,
  substituto_id uuid references public.escola_perfis(id) on delete set null,
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_autorizacoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid references public.escola_turmas(id) on delete set null,
  destino_tipo text not null,
  tipo text not null,
  titulo text not null,
  descricao text not null,
  local text,
  data_evento timestamptz,
  prazo_resposta timestamptz,
  prioridade text not null default 'normal',
  permite_observacao boolean not null default true,
  status text not null default 'publicada',
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_autorizacao_destinatarios (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  autorizacao_id uuid not null references public.escola_autorizacoes(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (autorizacao_id, aluno_id)
);

create table if not exists public.escola_autorizacao_respostas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  autorizacao_id uuid not null references public.escola_autorizacoes(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  responsavel_id uuid not null references public.escola_perfis(id) on delete cascade,
  decisao text not null,
  observacao text,
  respondido_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (autorizacao_id, aluno_id)
);

create table if not exists public.escola_autorizacao_resposta_historico (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  autorizacao_id uuid not null references public.escola_autorizacoes(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  responsavel_id uuid not null references public.escola_perfis(id) on delete cascade,
  decisao text not null,
  observacao text,
  registrado_em timestamptz not null default now()
);

create table if not exists public.escola_ocorrencias_aluno (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete restrict,
  categoria text not null default 'geral',
  prioridade text not null default 'normal',
  titulo text not null,
  descricao text not null,
  acao_tomada text,
  visivel_responsavel boolean not null default true,
  exige_ciencia boolean not null default false,
  status text not null default 'aberta',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_ocorrencia_ciencias (
  ocorrencia_id uuid not null references public.escola_ocorrencias_aluno(id) on delete cascade,
  responsavel_id uuid not null references public.escola_perfis(id) on delete cascade,
  ciente_em timestamptz not null default now(),
  primary key (ocorrencia_id, responsavel_id)
);

create table if not exists public.escola_pessoas_autorizadas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  nome text not null,
  parentesco text,
  telefone text,
  documento text,
  observacao text,
  ativo boolean not null default true,
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_retiradas_aluno (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  tipo_saida text not null default 'antecipada',
  tipo_pessoa text not null,
  pessoa_id uuid,
  nome_pessoa text not null,
  parentesco text,
  motivo text,
  observacao text,
  registrado_por uuid not null references auth.users(id) on delete restrict,
  retirado_em timestamptz not null default now()
);

create table if not exists public.escola_agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid references public.escola_turmas(id) on delete cascade,
  aluno_id uuid references public.escola_alunos(id) on delete cascade,
  tipo text not null default 'evento',
  titulo text not null,
  descricao text,
  inicio timestamptz not null,
  fim timestamptz,
  local text,
  prioridade text not null default 'normal',
  visivel_responsavel boolean not null default true,
  status text not null default 'ativo',
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  preco_mensal numeric(12,2) not null default 0,
  limite_alunos integer,
  limite_usuarios integer,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_pagamentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  valor numeric(12,2) not null default 0,
  vencimento date,
  pago_em timestamptz,
  status text not null default 'pendente',
  criado_em timestamptz not null default now()
);

create table if not exists public.escola_auditoria (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid references public.escola_escolas(id) on delete cascade,
  ator_id uuid references auth.users(id) on delete set null,
  ator_tipo text,
  acao text not null,
  recurso text not null,
  recurso_id uuid,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

-- Colunas necessárias em estruturas que podem ter sido criadas antes desta migration.
alter table public.escola_convites add column if not exists aceito_em timestamptz;
alter table public.escola_convites add column if not exists expira_em timestamptz default (now() + interval '14 days');
alter table public.escola_atividade_entregas add column if not exists comentario_professor text;
alter table public.escola_atividade_entregas add column if not exists atualizado_em timestamptz default now();
alter table public.escola_frequencias add column if not exists registrado_por uuid references auth.users(id) on delete set null;
alter table public.escola_justificativa_arquivos add column if not exists tamanho bigint;

create unique index if not exists escola_disciplinas_nome_uq on public.escola_disciplinas (escola_id, lower(trim(nome)));
create unique index if not exists escola_frequencia_falta_dia_uq on public.escola_frequencias (aluno_id, data_aula) where status = 'falta';
create index if not exists escola_grade_professor_idx on public.escola_grade_horarios (professor_id, dia_semana, hora_inicio) where ativo;
create index if not exists escola_alunos_turma_idx on public.escola_alunos (turma_id) where ativo;
create index if not exists escola_convites_email_idx on public.escola_convites (lower(email), status);
create index if not exists escola_comunicados_escola_idx on public.escola_comunicados (escola_id, publicado_em desc);
create index if not exists escola_ocorrencias_aluno_idx on public.escola_ocorrencias_aluno (aluno_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Helpers de autorização. SECURITY DEFINER evita recursão de RLS.
-- ---------------------------------------------------------------------------
create or replace function public.escola_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.escola_super_admins s
    where s.user_id = auth.uid() and s.ativo = true
  );
$$;

create or replace function public.escola_current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.escola_id
  from public.escola_perfis p
  join public.escola_escolas e on e.id = p.escola_id
  where p.id = auth.uid() and p.ativo = true and e.status in ('ativa','teste')
  limit 1;
$$;

create or replace function public.escola_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.papel from public.escola_perfis p
  where p.id = auth.uid() and p.ativo = true
  limit 1;
$$;

create or replace function public.escola_same_school(p_escola_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.escola_is_super_admin() or public.escola_current_school_id() = p_escola_id;
$$;

create or replace function public.escola_can_manage_school(p_escola_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.escola_is_super_admin() or exists (
    select 1 from public.escola_perfis p
    join public.escola_escolas e on e.id = p.escola_id
    where p.id = auth.uid() and p.ativo = true and p.escola_id = p_escola_id
      and p.papel in ('admin_escola','direcao','coordenacao')
      and e.status in ('ativa','teste')
  );
$$;

create or replace function public.escola_can_access_class(p_turma_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.escola_is_super_admin()
  or exists (
    select 1 from public.escola_turmas t
    where t.id = p_turma_id and public.escola_can_manage_school(t.escola_id)
  )
  or exists (
    select 1 from public.escola_professor_alocacoes a
    join public.escola_turmas t on t.id = a.turma_id
    where a.turma_id = p_turma_id and a.professor_id = auth.uid() and a.ativo = true and t.ativa = true
  )
  or exists (
    select 1 from public.escola_aluno_responsaveis ar
    join public.escola_alunos a on a.id = ar.aluno_id
    where ar.responsavel_id = auth.uid() and a.turma_id = p_turma_id and a.ativo = true
  );
$$;

create or replace function public.escola_can_access_student(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.escola_is_super_admin()
  or exists (
    select 1 from public.escola_alunos a
    where a.id = p_aluno_id and public.escola_can_manage_school(a.escola_id)
  )
  or exists (
    select 1 from public.escola_alunos a
    join public.escola_professor_alocacoes pa on pa.turma_id = a.turma_id and pa.professor_id = auth.uid() and pa.ativo = true
    where a.id = p_aluno_id and a.ativo = true
  )
  or exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id = p_aluno_id and ar.responsavel_id = auth.uid()
  );
$$;

create or replace function public.escola_can_access_student_document(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.escola_is_super_admin()
  or exists (select 1 from public.escola_alunos a where a.id = p_aluno_id and public.escola_can_manage_school(a.escola_id))
  or exists (select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id = p_aluno_id and ar.responsavel_id = auth.uid());
$$;

create or replace function public.escola_try_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestão escolar
-- ---------------------------------------------------------------------------
create or replace function public.escola_school_dashboard()
returns table (turmas bigint, alunos bigint, professores bigint, responsaveis bigint, convites_pendentes bigint)
language plpgsql
security definer
set search_path = public
as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  return query select
    (select count(*) from public.escola_turmas t where t.escola_id=v_escola and t.ativa),
    (select count(*) from public.escola_alunos a where a.escola_id=v_escola and a.ativo),
    (select count(*) from public.escola_perfis p where p.escola_id=v_escola and p.ativo and p.papel='professor'),
    (select count(*) from public.escola_perfis p where p.escola_id=v_escola and p.ativo and p.papel='responsavel'),
    (select count(*) from public.escola_convites c where c.escola_id=v_escola and c.status='pendente' and c.papel <> 'aluno');
end;
$$;

create or replace function public.escola_school_list_classes()
returns table (id uuid, nome text, ano_letivo integer, turno text, ativa boolean, professor_responsavel_id uuid, professor_nome text, total_alunos bigint)
language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  return query select t.id,t.nome,t.ano_letivo,t.turno,t.ativa,t.professor_responsavel_id,p.nome,
    (select count(*) from public.escola_alunos a where a.turma_id=t.id and a.ativo)
  from public.escola_turmas t left join public.escola_perfis p on p.id=t.professor_responsavel_id
  where t.escola_id=v_escola order by t.nome;
end; $$;

create or replace function public.escola_school_list_profiles()
returns table (id uuid, nome text, email text, telefone text, papel text, ativo boolean, is_teste boolean, criado_em timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  return query select p.id,p.nome,p.email,p.telefone,p.papel,p.ativo,p.is_teste,p.criado_em from public.escola_perfis p where p.escola_id=v_escola and p.papel <> 'aluno' order by p.nome;
end; $$;

create or replace function public.escola_school_list_students()
returns table (id uuid, nome text, data_nascimento date, turma_id uuid, turma_nome text, ativo boolean, total_responsaveis bigint)
language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  return query select a.id,a.nome,a.data_nascimento,a.turma_id,t.nome,a.ativo,
    (select count(*) from public.escola_aluno_responsaveis ar where ar.aluno_id=a.id)
  from public.escola_alunos a left join public.escola_turmas t on t.id=a.turma_id where a.escola_id=v_escola order by a.nome;
end; $$;

create or replace function public.escola_school_list_guardians()
returns table (id uuid, nome text, email text, telefone text, ativo boolean, total_alunos bigint)
language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  return query select p.id,p.nome,p.email,p.telefone,p.ativo,(select count(*) from public.escola_aluno_responsaveis ar where ar.responsavel_id=p.id)
  from public.escola_perfis p where p.escola_id=v_escola and p.papel='responsavel' order by p.nome;
end; $$;

create or replace function public.escola_school_list_invites()
returns table (id uuid, nome text, email text, papel text, status text, aluno_id uuid, criado_em timestamptz, expira_em timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  return query select c.id,c.nome,c.email,c.papel,c.status,c.aluno_id,c.criado_em,c.expira_em from public.escola_convites c where c.escola_id=v_escola and c.papel <> 'aluno' order by c.criado_em desc;
end; $$;

create or replace function public.escola_school_set_profile_active(p_id uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  update public.escola_perfis set ativo=p_ativo, atualizado_em=now() where id=p_id and escola_id=v_escola and papel <> 'aluno';
end; $$;

create or replace function public.escola_school_upsert_student(p_id uuid, p_nome text, p_data_nascimento date, p_turma_id uuid, p_ativo boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id(); v_id uuid;
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if trim(coalesce(p_nome,''))='' then raise exception 'Nome do aluno é obrigatório'; end if;
  if p_turma_id is not null and not exists(select 1 from public.escola_turmas where id=p_turma_id and escola_id=v_escola) then raise exception 'Turma inválida'; end if;
  if p_id is null then
    insert into public.escola_alunos(escola_id,nome,data_nascimento,turma_id,ativo) values(v_escola,trim(p_nome),p_data_nascimento,p_turma_id,coalesce(p_ativo,true)) returning id into v_id;
  else
    update public.escola_alunos set nome=trim(p_nome),data_nascimento=p_data_nascimento,turma_id=p_turma_id,ativo=coalesce(p_ativo,true),atualizado_em=now() where id=p_id and escola_id=v_escola returning id into v_id;
    if v_id is null then raise exception 'Aluno não encontrado'; end if;
  end if;
  return v_id;
end; $$;

create or replace function public.escola_school_upsert_class(p_id uuid, p_nome text, p_ano_letivo integer, p_turno text, p_professor_id uuid, p_ativa boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id(); v_id uuid;
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if p_professor_id is not null and not exists(select 1 from public.escola_perfis where id=p_professor_id and escola_id=v_escola and papel='professor' and ativo) then raise exception 'Professor regente inválido'; end if;
  if p_id is null then insert into public.escola_turmas(escola_id,nome,ano_letivo,turno,professor_responsavel_id,ativa) values(v_escola,trim(p_nome),p_ano_letivo,p_turno,p_professor_id,coalesce(p_ativa,true)) returning id into v_id;
  else update public.escola_turmas set nome=trim(p_nome),ano_letivo=p_ano_letivo,turno=p_turno,professor_responsavel_id=p_professor_id,ativa=coalesce(p_ativa,true),atualizado_em=now() where id=p_id and escola_id=v_escola returning id into v_id; end if;
  if v_id is null then raise exception 'Turma não encontrada'; end if; return v_id;
end; $$;

create or replace function public.escola_school_create_invite(p_nome text, p_email text, p_papel text, p_aluno_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id(); v_id uuid;
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if p_papel not in ('admin_escola','direcao','coordenacao','professor','responsavel') then raise exception 'Perfil inválido'; end if;
  if p_aluno_id is not null and not exists(select 1 from public.escola_alunos where id=p_aluno_id and escola_id=v_escola) then raise exception 'Aluno inválido'; end if;
  update public.escola_convites set nome=trim(p_nome),papel=p_papel,aluno_id=p_aluno_id,status='pendente',expira_em=now()+interval '14 days',atualizado_em=now()
    where id=(select id from public.escola_convites where escola_id=v_escola and lower(email)=lower(trim(p_email)) and status='pendente' order by criado_em desc limit 1)
    returning id into v_id;
  if v_id is null then insert into public.escola_convites(escola_id,nome,email,papel,aluno_id,status) values(v_escola,trim(p_nome),lower(trim(p_email)),p_papel,p_aluno_id,'pendente') returning id into v_id; end if;
  return v_id;
end; $$;

create or replace function public.escola_school_revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if; update public.escola_convites set status='revogado',atualizado_em=now() where id=p_id and escola_id=v_escola and status='pendente'; end; $$;

create or replace function public.escola_school_student_guardians(p_aluno_id uuid)
returns table (responsavel_id uuid,nome text,email text,parentesco text,principal boolean,autorizado_buscar boolean)
language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if not public.escola_can_manage_school(v_escola) or not exists(select 1 from public.escola_alunos where id=p_aluno_id and escola_id=v_escola) then raise exception 'Acesso negado'; end if;
  return query select p.id,p.nome,p.email,ar.parentesco,ar.principal,ar.autorizado_buscar from public.escola_aluno_responsaveis ar join public.escola_perfis p on p.id=ar.responsavel_id where ar.aluno_id=p_aluno_id order by ar.principal desc,p.nome;
end; $$;

create or replace function public.escola_school_link_guardian(p_aluno_id uuid,p_responsavel_id uuid,p_parentesco text,p_principal boolean,p_autorizado_buscar boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if not exists(select 1 from public.escola_alunos where id=p_aluno_id and escola_id=v_escola) or not exists(select 1 from public.escola_perfis where id=p_responsavel_id and escola_id=v_escola and papel='responsavel') then raise exception 'Vínculo inválido'; end if;
  if coalesce(p_principal,false) then update public.escola_aluno_responsaveis set principal=false where aluno_id=p_aluno_id; end if;
  insert into public.escola_aluno_responsaveis(escola_id,aluno_id,responsavel_id,parentesco,principal,autorizado_buscar) values(v_escola,p_aluno_id,p_responsavel_id,p_parentesco,coalesce(p_principal,false),coalesce(p_autorizado_buscar,true)) on conflict(aluno_id,responsavel_id) do update set parentesco=excluded.parentesco,principal=excluded.principal,autorizado_buscar=excluded.autorizado_buscar;
end; $$;

create or replace function public.escola_school_unlink_guardian(p_aluno_id uuid,p_responsavel_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id();
begin if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if; delete from public.escola_aluno_responsaveis where escola_id=v_escola and aluno_id=p_aluno_id and responsavel_id=p_responsavel_id; end; $$;

-- Importação em massa realmente atômica: qualquer erro reverte tudo.
create or replace function public.escola_school_bulk_import(p_tipo text,p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare v_escola uuid := public.escola_current_school_id(); v_row jsonb; v_count integer:=0; v_turma uuid; v_aluno uuid; v_role text;
begin
  if not public.escola_can_manage_school(v_escola) or public.escola_current_role()='coordenacao' then raise exception 'Acesso negado'; end if;
  if p_tipo not in ('alunos','equipe','responsaveis') or jsonb_typeof(p_rows)<>'array' then raise exception 'Importação inválida'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if trim(coalesce(v_row->>'nome',''))='' then raise exception 'Nome obrigatório'; end if;
    if p_tipo='alunos' then
      v_turma:=null;
      if nullif(trim(coalesce(v_row->>'turma','')),'') is not null then select id into v_turma from public.escola_turmas where escola_id=v_escola and ativa and lower(trim(nome))=lower(trim(v_row->>'turma')) limit 1; if v_turma is null then raise exception 'Turma não encontrada: %',v_row->>'turma'; end if; end if;
      perform public.escola_school_upsert_student(null,v_row->>'nome',nullif(v_row->>'data_nascimento','')::date,v_turma,true);
    elsif p_tipo='equipe' then
      v_role:=v_row->>'perfil'; if v_role not in ('professor','coordenacao') then raise exception 'Perfil inválido: %',v_role; end if;
      perform public.escola_school_create_invite(v_row->>'nome',v_row->>'email',v_role,null);
    else
      v_aluno:=null;
      if nullif(trim(coalesce(v_row->>'aluno','')),'') is not null then select id into v_aluno from public.escola_alunos where escola_id=v_escola and ativo and lower(trim(nome))=lower(trim(v_row->>'aluno')) limit 1; if v_aluno is null then raise exception 'Aluno não encontrado: %',v_row->>'aluno'; end if; end if;
      perform public.escola_school_create_invite(v_row->>'nome',v_row->>'email','responsavel',v_aluno);
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;

-- ---------------------------------------------------------------------------
-- Grade Professor × Turma × Disciplina
-- ---------------------------------------------------------------------------
create or replace function public.escola_school_import_schedule(p_rows jsonb,p_ano_letivo integer)
returns integer language plpgsql security definer set search_path=public as $$
declare v_escola uuid:=public.escola_current_school_id(); v_row jsonb; v_prof uuid; v_turma uuid; v_disc uuid; v_dia integer; v_ini time; v_fim time; v_count integer:=0;
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Grade inválida'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    select id into v_prof from public.escola_perfis where escola_id=v_escola and papel='professor' and ativo and lower(trim(nome))=lower(trim(v_row->>'professor')) limit 1;
    if v_prof is null then raise exception 'Professor não encontrado: %',v_row->>'professor'; end if;
    select id into v_turma from public.escola_turmas where escola_id=v_escola and ativa and lower(trim(nome))=lower(trim(v_row->>'turma')) limit 1;
    if v_turma is null then raise exception 'Turma não encontrada: %',v_row->>'turma'; end if;
    select id into v_disc from public.escola_disciplinas where escola_id=v_escola and lower(trim(nome))=lower(trim(v_row->>'disciplina')) limit 1;
    if v_disc is null then insert into public.escola_disciplinas(escola_id,nome,ativa) values(v_escola,trim(v_row->>'disciplina'),true) returning id into v_disc; end if;
    v_dia:=(v_row->>'dia_semana')::integer; v_ini:=(v_row->>'hora_inicio')::time; v_fim:=(v_row->>'hora_fim')::time;
    if v_dia not between 1 and 7 or v_fim<=v_ini then raise exception 'Horário inválido'; end if;
    if exists(select 1 from public.escola_grade_horarios g where g.escola_id=v_escola and g.ativo and g.ano_letivo=p_ano_letivo and g.dia_semana=v_dia and g.professor_id=v_prof and g.hora_inicio < v_fim and g.hora_fim > v_ini) then raise exception 'Conflito de horário do professor %',v_row->>'professor'; end if;
    if exists(select 1 from public.escola_grade_horarios g where g.escola_id=v_escola and g.ativo and g.ano_letivo=p_ano_letivo and g.dia_semana=v_dia and g.turma_id=v_turma and g.hora_inicio < v_fim and g.hora_fim > v_ini) then raise exception 'Conflito de horário da turma %',v_row->>'turma'; end if;
    insert into public.escola_professor_alocacoes(escola_id,professor_id,turma_id,disciplina_id,ativo) values(v_escola,v_prof,v_turma,v_disc,true) on conflict(professor_id,turma_id,disciplina_id) do update set ativo=true;
    insert into public.escola_grade_horarios(escola_id,turma_id,professor_id,disciplina_id,dia_semana,hora_inicio,hora_fim,sala,ano_letivo,ativo) values(v_escola,v_turma,v_prof,v_disc,v_dia,v_ini,v_fim,nullif(v_row->>'sala',''),p_ano_letivo,true);
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;

-- ---------------------------------------------------------------------------
-- Comunicação e faltas por exceção
-- ---------------------------------------------------------------------------
create or replace function public.escola_mark_communication(p_comunicado_id uuid,p_confirmar boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid; v_turma uuid; v_role text:=public.escola_current_role();
begin
  select escola_id,turma_id into v_escola,v_turma from public.escola_comunicados where id=p_comunicado_id and status='publicado';
  if v_escola is null or public.escola_current_school_id()<>v_escola then raise exception 'Acesso negado'; end if;
  if v_role='responsavel' and v_turma is not null and not public.escola_can_access_class(v_turma) then raise exception 'Acesso negado'; end if;
  insert into public.escola_comunicado_leituras(comunicado_id,usuario_id,lido_em,confirmado_em) values(p_comunicado_id,auth.uid(),now(),case when p_confirmar then now() else null end)
  on conflict(comunicado_id,usuario_id) do update set lido_em=coalesce(public.escola_comunicado_leituras.lido_em,now()),confirmado_em=case when p_confirmar then coalesce(public.escola_comunicado_leituras.confirmado_em,now()) else public.escola_comunicado_leituras.confirmado_em end;
end; $$;

create or replace function public.escola_register_absence(p_aluno_id uuid,p_data_aula date,p_observacao text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid:=public.escola_current_school_id(); v_turma uuid; v_id uuid;
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  select turma_id into v_turma from public.escola_alunos where id=p_aluno_id and escola_id=v_escola and ativo;
  if not found then raise exception 'Aluno não encontrado'; end if;
  insert into public.escola_frequencias(escola_id,grade_id,turma_id,aluno_id,data_aula,status,observacao,registrado_por) values(v_escola,null,v_turma,p_aluno_id,p_data_aula,'falta',p_observacao,auth.uid())
  on conflict(aluno_id,data_aula) where status='falta' do update set observacao=excluded.observacao,atualizado_em=now() returning id into v_id;
  return v_id;
end; $$;

create or replace function public.escola_guardian_submit_absence_justification(p_frequencia_id uuid,p_motivo text,p_descricao text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_abs public.escola_frequencias%rowtype; v_id uuid;
begin
  select * into v_abs from public.escola_frequencias where id=p_frequencia_id and status='falta';
  if v_abs.id is null or not exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=v_abs.aluno_id and ar.responsavel_id=auth.uid()) then raise exception 'Acesso negado'; end if;
  insert into public.escola_justificativas_falta(escola_id,frequencia_id,aluno_id,responsavel_id,motivo,descricao,status) values(v_abs.escola_id,v_abs.id,v_abs.aluno_id,auth.uid(),trim(p_motivo),p_descricao,'pendente')
  on conflict(frequencia_id,responsavel_id) do update set motivo=excluded.motivo,descricao=excluded.descricao,status='pendente',observacao_analise=null,analisado_por=null,analisado_em=null,atualizado_em=now() returning id into v_id;
  return v_id;
end; $$;

create or replace function public.escola_review_absence_justification(p_justificativa_id uuid,p_status text,p_observacao text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid;
begin
  if p_status not in ('aprovada','recusada','correcao_solicitada') then raise exception 'Status inválido'; end if;
  select escola_id into v_escola from public.escola_justificativas_falta where id=p_justificativa_id;
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  update public.escola_justificativas_falta set status=p_status,observacao_analise=p_observacao,analisado_por=auth.uid(),analisado_em=now(),atualizado_em=now() where id=p_justificativa_id;
end; $$;

create or replace function public.escola_create_priority_schedule_notice(p_grade_id uuid,p_data date,p_tipo text,p_motivo text default null,p_novo_horario_saida time default null,p_substituto_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_grade public.escola_grade_horarios%rowtype; v_id uuid; v_title text;
begin
  select * into v_grade from public.escola_grade_horarios where id=p_grade_id and ativo;
  if v_grade.id is null or not public.escola_can_manage_school(v_grade.escola_id) then raise exception 'Acesso negado'; end if;
  insert into public.escola_intercorrencias_grade(escola_id,grade_id,turma_id,tipo,data_evento,novo_horario_saida,motivo,substituto_id,criado_por) values(v_grade.escola_id,v_grade.id,v_grade.turma_id,p_tipo,p_data,p_novo_horario_saida,p_motivo,p_substituto_id,auth.uid()) returning id into v_id;
  v_title:=case p_tipo when 'saida_antecipada' then 'Saída antecipada' when 'aula_cancelada' then 'Aula cancelada' when 'professor_ausente' then 'Alteração de aula' else 'Aviso importante' end;
  insert into public.escola_comunicados(escola_id,turma_id,autor_id,titulo,resumo,conteudo,prioridade,exige_confirmacao,status,publicado_em) values(v_grade.escola_id,v_grade.turma_id,auth.uid(),v_title,p_motivo,coalesce(p_motivo,v_title),'urgente',true,'publicado',now());
  return v_id;
end; $$;

-- ---------------------------------------------------------------------------
-- Autorizações
-- ---------------------------------------------------------------------------
create or replace function public.escola_create_authorization(p_destino_tipo text,p_turma_id uuid,p_aluno_ids uuid[],p_tipo text,p_titulo text,p_descricao text,p_local text,p_data_evento timestamptz,p_prazo_resposta timestamptz,p_prioridade text,p_permite_observacao boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid:=public.escola_current_school_id(); v_id uuid;
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if p_destino_tipo not in ('escola','turma','alunos') then raise exception 'Destino inválido'; end if;
  if p_destino_tipo='turma' and not exists(select 1 from public.escola_turmas where id=p_turma_id and escola_id=v_escola) then raise exception 'Turma inválida'; end if;
  insert into public.escola_autorizacoes(escola_id,turma_id,destino_tipo,tipo,titulo,descricao,local,data_evento,prazo_resposta,prioridade,permite_observacao,status,criado_por)
  values(v_escola,case when p_destino_tipo='turma' then p_turma_id else null end,p_destino_tipo,p_tipo,trim(p_titulo),p_descricao,p_local,p_data_evento,p_prazo_resposta,coalesce(p_prioridade,'normal'),coalesce(p_permite_observacao,true),'publicada',auth.uid()) returning id into v_id;
  if p_destino_tipo='escola' then insert into public.escola_autorizacao_destinatarios(escola_id,autorizacao_id,aluno_id) select v_escola,v_id,a.id from public.escola_alunos a where a.escola_id=v_escola and a.ativo;
  elsif p_destino_tipo='turma' then insert into public.escola_autorizacao_destinatarios(escola_id,autorizacao_id,aluno_id) select v_escola,v_id,a.id from public.escola_alunos a where a.escola_id=v_escola and a.turma_id=p_turma_id and a.ativo;
  else insert into public.escola_autorizacao_destinatarios(escola_id,autorizacao_id,aluno_id) select v_escola,v_id,a.id from public.escola_alunos a where a.escola_id=v_escola and a.ativo and a.id=any(coalesce(p_aluno_ids,array[]::uuid[])); end if;
  return v_id;
end; $$;

create or replace function public.escola_respond_authorization(p_autorizacao_id uuid,p_aluno_id uuid,p_decisao text,p_observacao text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid; v_id uuid;
begin
  if p_decisao not in ('autorizada','recusada') then raise exception 'Decisão inválida'; end if;
  select a.escola_id into v_escola from public.escola_autorizacoes a join public.escola_autorizacao_destinatarios d on d.autorizacao_id=a.id and d.aluno_id=p_aluno_id where a.id=p_autorizacao_id and a.status='publicada' and (a.prazo_resposta is null or a.prazo_resposta>=now());
  if v_escola is null or not exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=p_aluno_id and ar.responsavel_id=auth.uid()) then raise exception 'Acesso negado'; end if;
  insert into public.escola_autorizacao_respostas(escola_id,autorizacao_id,aluno_id,responsavel_id,decisao,observacao) values(v_escola,p_autorizacao_id,p_aluno_id,auth.uid(),p_decisao,p_observacao)
  on conflict(autorizacao_id,aluno_id) do update set responsavel_id=auth.uid(),decisao=excluded.decisao,observacao=excluded.observacao,atualizado_em=now() returning id into v_id;
  insert into public.escola_autorizacao_resposta_historico(escola_id,autorizacao_id,aluno_id,responsavel_id,decisao,observacao) values(v_escola,p_autorizacao_id,p_aluno_id,auth.uid(),p_decisao,p_observacao);
  return v_id;
end; $$;

create or replace function public.escola_close_authorization(p_autorizacao_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid;
begin select escola_id into v_escola from public.escola_autorizacoes where id=p_autorizacao_id; if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if; update public.escola_autorizacoes set status='encerrada',atualizado_em=now() where id=p_autorizacao_id; end; $$;

-- ---------------------------------------------------------------------------
-- Segurança do aluno
-- ---------------------------------------------------------------------------
create or replace function public.escola_create_student_occurrence(p_aluno_id uuid,p_categoria text,p_prioridade text,p_titulo text,p_descricao text,p_acao_tomada text,p_visivel_responsavel boolean,p_exige_ciencia boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid; v_id uuid; v_role text:=public.escola_current_role();
begin
  select escola_id into v_escola from public.escola_alunos where id=p_aluno_id and ativo;
  if v_escola is null or not public.escola_can_access_student(p_aluno_id) or v_role not in ('admin_escola','direcao','coordenacao','professor') then raise exception 'Acesso negado'; end if;
  insert into public.escola_ocorrencias_aluno(escola_id,aluno_id,autor_id,categoria,prioridade,titulo,descricao,acao_tomada,visivel_responsavel,exige_ciencia,status) values(v_escola,p_aluno_id,auth.uid(),p_categoria,coalesce(p_prioridade,'normal'),trim(p_titulo),p_descricao,p_acao_tomada,coalesce(p_visivel_responsavel,true),coalesce(p_exige_ciencia,false),'aberta') returning id into v_id; return v_id;
end; $$;

create or replace function public.escola_ack_student_occurrence(p_ocorrencia_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_aluno uuid; v_visible boolean;
begin select aluno_id,visivel_responsavel into v_aluno,v_visible from public.escola_ocorrencias_aluno where id=p_ocorrencia_id and status='aberta'; if not coalesce(v_visible,false) or not exists(select 1 from public.escola_aluno_responsaveis where aluno_id=v_aluno and responsavel_id=auth.uid()) then raise exception 'Acesso negado'; end if; insert into public.escola_ocorrencia_ciencias(ocorrencia_id,responsavel_id,ciente_em) values(p_ocorrencia_id,auth.uid(),now()) on conflict(ocorrencia_id,responsavel_id) do update set ciente_em=excluded.ciente_em; end; $$;

create or replace function public.escola_manage_authorized_pickup_person(p_id uuid,p_aluno_id uuid,p_nome text,p_parentesco text,p_telefone text,p_documento text,p_observacao text,p_ativo boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid; v_new uuid;
begin
  select escola_id into v_escola from public.escola_alunos where id=p_aluno_id and ativo;
  if v_escola is null or not public.escola_can_access_student_document(p_aluno_id) then raise exception 'Acesso negado'; end if;
  if p_id is null then insert into public.escola_pessoas_autorizadas(escola_id,aluno_id,nome,parentesco,telefone,documento,observacao,ativo,criado_por) values(v_escola,p_aluno_id,trim(p_nome),p_parentesco,p_telefone,p_documento,p_observacao,coalesce(p_ativo,true),auth.uid()) returning id into v_new;
  else update public.escola_pessoas_autorizadas set nome=trim(p_nome),parentesco=p_parentesco,telefone=p_telefone,documento=p_documento,observacao=p_observacao,ativo=coalesce(p_ativo,true),atualizado_em=now() where id=p_id and aluno_id=p_aluno_id and escola_id=v_escola returning id into v_new; end if;
  if v_new is null then raise exception 'Pessoa autorizada não encontrada'; end if; return v_new;
end; $$;

create or replace function public.escola_student_pickup_options(p_aluno_id uuid)
returns table (tipo_pessoa text,pessoa_id uuid,nome text,parentesco text,telefone text,documento text)
language plpgsql security definer set search_path=public as $$
begin
  if not public.escola_can_access_student_document(p_aluno_id) then raise exception 'Acesso negado'; end if;
  return query
  select 'responsavel'::text,p.id,p.nome,ar.parentesco,p.telefone,null::text from public.escola_aluno_responsaveis ar join public.escola_perfis p on p.id=ar.responsavel_id where ar.aluno_id=p_aluno_id and ar.autorizado_buscar and p.ativo
  union all
  select 'pessoa_autorizada'::text,pa.id,pa.nome,pa.parentesco,pa.telefone,pa.documento from public.escola_pessoas_autorizadas pa where pa.aluno_id=p_aluno_id and pa.ativo;
end; $$;

create or replace function public.escola_register_student_pickup(p_aluno_id uuid,p_tipo_saida text,p_tipo_pessoa text,p_pessoa_id uuid,p_motivo text default null,p_observacao text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid; v_nome text; v_parentesco text; v_id uuid;
begin
  select escola_id into v_escola from public.escola_alunos where id=p_aluno_id and ativo;
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if p_tipo_pessoa='responsavel' then select p.nome,ar.parentesco into v_nome,v_parentesco from public.escola_aluno_responsaveis ar join public.escola_perfis p on p.id=ar.responsavel_id where ar.aluno_id=p_aluno_id and ar.responsavel_id=p_pessoa_id and ar.autorizado_buscar and p.ativo;
  elsif p_tipo_pessoa='pessoa_autorizada' then select nome,parentesco into v_nome,v_parentesco from public.escola_pessoas_autorizadas where id=p_pessoa_id and aluno_id=p_aluno_id and ativo; else raise exception 'Tipo de pessoa inválido'; end if;
  if v_nome is null then raise exception 'Pessoa não autorizada para retirar este aluno'; end if;
  insert into public.escola_retiradas_aluno(escola_id,aluno_id,tipo_saida,tipo_pessoa,pessoa_id,nome_pessoa,parentesco,motivo,observacao,registrado_por) values(v_escola,p_aluno_id,p_tipo_saida,p_tipo_pessoa,p_pessoa_id,v_nome,v_parentesco,p_motivo,p_observacao,auth.uid()) returning id into v_id; return v_id;
end; $$;

-- ---------------------------------------------------------------------------
-- Agenda e linha do tempo
-- ---------------------------------------------------------------------------
create or replace function public.escola_create_agenda_event(p_tipo text,p_titulo text,p_descricao text,p_inicio timestamptz,p_fim timestamptz,p_local text,p_prioridade text,p_turma_id uuid,p_aluno_id uuid,p_visivel_responsavel boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_escola uuid:=public.escola_current_school_id(); v_id uuid;
begin
  if not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if p_turma_id is not null and not exists(select 1 from public.escola_turmas where id=p_turma_id and escola_id=v_escola) then raise exception 'Turma inválida'; end if;
  if p_aluno_id is not null and not exists(select 1 from public.escola_alunos where id=p_aluno_id and escola_id=v_escola) then raise exception 'Aluno inválido'; end if;
  insert into public.escola_agenda_eventos(escola_id,turma_id,aluno_id,tipo,titulo,descricao,inicio,fim,local,prioridade,visivel_responsavel,status,criado_por) values(v_escola,p_turma_id,p_aluno_id,p_tipo,trim(p_titulo),p_descricao,p_inicio,p_fim,p_local,coalesce(p_prioridade,'normal'),coalesce(p_visivel_responsavel,true),'ativo',auth.uid()) returning id into v_id; return v_id;
end; $$;

create or replace function public.escola_set_agenda_event_status(p_evento_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v_escola uuid;
begin if p_status not in ('ativo','cancelado','concluido') then raise exception 'Status inválido'; end if; select escola_id into v_escola from public.escola_agenda_eventos where id=p_evento_id; if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if; update public.escola_agenda_eventos set status=p_status,atualizado_em=now() where id=p_evento_id; end; $$;

create or replace function public.escola_agenda_feed(p_inicio timestamptz,p_fim timestamptz,p_aluno_id uuid default null)
returns table (evento_id uuid,fonte text,titulo text,descricao text,inicio timestamptz,fim timestamptz,local text,prioridade text,aluno_id uuid,turma_id uuid,status text)
language plpgsql security definer set search_path=public as $$
declare v_escola uuid:=public.escola_current_school_id(); v_role text:=public.escola_current_role(); v_turma uuid;
begin
  if public.escola_is_super_admin() and v_escola is null then raise exception 'Selecione uma escola para a agenda'; end if;
  if v_escola is null then raise exception 'Perfil escolar inválido'; end if;
  if p_aluno_id is not null then if not public.escola_can_access_student(p_aluno_id) then raise exception 'Acesso negado'; end if; select a.turma_id into v_turma from public.escola_alunos a where a.id=p_aluno_id; end if;
  if v_role='responsavel' and p_aluno_id is null then raise exception 'Selecione um aluno'; end if;
  return query
  select e.id,'evento'::text,e.titulo,e.descricao,e.inicio,e.fim,e.local,e.prioridade,e.aluno_id,e.turma_id,e.status from public.escola_agenda_eventos e
    where e.escola_id=v_escola and e.inicio>=p_inicio and e.inicio<p_fim
      and (p_aluno_id is null or e.aluno_id=p_aluno_id or (e.aluno_id is null and (e.turma_id is null or e.turma_id=v_turma)))
      and (v_role in ('admin_escola','direcao','coordenacao') or (v_role='professor' and (e.turma_id is null or public.escola_can_access_class(e.turma_id))) or (v_role='responsavel' and e.visivel_responsavel))
  union all
  select r.id,'reuniao',r.titulo,r.pauta,r.inicio,r.fim,r.local,'importante',r.aluno_id,null::uuid,r.status from public.escola_reunioes r
    where r.escola_id=v_escola and r.inicio>=p_inicio and r.inicio<p_fim and (p_aluno_id is null or r.aluno_id=p_aluno_id)
      and (v_role in ('admin_escola','direcao','coordenacao') or (v_role='professor' and (r.aluno_id is null or public.escola_can_access_student(r.aluno_id))) or (v_role='responsavel' and (r.responsavel_id=auth.uid() or (r.aluno_id is not null and public.escola_can_access_student(r.aluno_id)))))
  union all
  select a.id,'atividade',a.titulo,a.descricao,(a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina',null::timestamptz,null::text,'normal',p_aluno_id,a.turma_id,a.status from public.escola_atividades a
    where a.escola_id=v_escola and a.data_entrega is not null and ((a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina')>=p_inicio and ((a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina')<p_fim
      and (p_aluno_id is null or a.turma_id=v_turma) and (v_role in ('admin_escola','direcao','coordenacao') or (v_role='professor' and a.professor_id=auth.uid()) or (v_role='responsavel' and public.escola_can_access_class(a.turma_id)))
  union all
  select au.id,'autorizacao',au.titulo,au.descricao,au.data_evento,null::timestamptz,au.local,au.prioridade,p_aluno_id,au.turma_id,au.status from public.escola_autorizacoes au
    where au.escola_id=v_escola and au.data_evento is not null and au.data_evento>=p_inicio and au.data_evento<p_fim
      and (p_aluno_id is null or exists(select 1 from public.escola_autorizacao_destinatarios d where d.autorizacao_id=au.id and d.aluno_id=p_aluno_id))
      and v_role in ('admin_escola','direcao','coordenacao','responsavel');
end; $$;

create or replace function public.escola_student_timeline(p_aluno_id uuid,p_limit integer default 150)
returns table (item_id uuid,tipo text,titulo text,descricao text,momento timestamptz,status text,prioridade text)
language plpgsql security definer set search_path=public as $$
declare v_role text:=public.escola_current_role();
begin
  if not public.escola_can_access_student(p_aluno_id) then raise exception 'Acesso negado'; end if;
  return query select * from (
    select o.id,'ocorrencia'::text,o.titulo,o.descricao,o.criado_em,o.status,o.prioridade from public.escola_ocorrencias_aluno o where o.aluno_id=p_aluno_id and (v_role<>'responsavel' or o.visivel_responsavel)
    union all select r.id,'retirada','Retirada do aluno',concat_ws(' · ',r.nome_pessoa,r.motivo),r.retirado_em,'registrada','importante' from public.escola_retiradas_aluno r where r.aluno_id=p_aluno_id
    union all select a.id,'acompanhamento',a.titulo,a.observacao,a.criado_em,a.status,'normal' from public.escola_acompanhamentos a where a.aluno_id=p_aluno_id and (v_role<>'responsavel' or a.visivel_responsavel)
    union all select f.id,'falta','Falta registrada',f.observacao,f.criado_em,f.status,'importante' from public.escola_frequencias f where f.aluno_id=p_aluno_id and f.status='falta'
    union all select m.id,'reuniao',m.titulo,m.pauta,m.inicio,m.status,'normal' from public.escola_reunioes m where m.aluno_id=p_aluno_id
  ) x order by x.momento desc limit greatest(1,least(coalesce(p_limit,150),500));
end; $$;

-- ---------------------------------------------------------------------------
-- RLS: remove políticas escolares antigas e recria o modelo central.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename like 'escola_%' loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'escola_%' loop
    execute format('alter table public.%I enable row level security',r.relname);
    execute format('create policy escola_super_admin_all on public.%I for all to authenticated using (public.escola_is_super_admin()) with check (public.escola_is_super_admin())',r.relname);
  end loop;
end $$;

create policy escola_self_school_select on public.escola_escolas for select to authenticated using (id=public.escola_current_school_id());
create policy escola_profile_self_or_manager_select on public.escola_perfis for select to authenticated using (id=auth.uid() or public.escola_can_manage_school(escola_id));
create policy escola_profile_manager_write on public.escola_perfis for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id) and papel<>'aluno');
create policy escola_turma_select on public.escola_turmas for select to authenticated using (public.escola_can_access_class(id));
create policy escola_turma_manager_write on public.escola_turmas for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_aluno_select on public.escola_alunos for select to authenticated using (public.escola_can_access_student(id));
create policy escola_aluno_manager_write on public.escola_alunos for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_vinculo_select on public.escola_aluno_responsaveis for select to authenticated using (responsavel_id=auth.uid() or public.escola_can_manage_school(escola_id));
create policy escola_vinculo_manager_write on public.escola_aluno_responsaveis for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_convite_manager_all on public.escola_convites for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id) and papel<>'aluno');
create policy escola_disciplina_staff_select on public.escola_disciplinas for select to authenticated using (public.escola_same_school(escola_id) and public.escola_current_role() in ('admin_escola','direcao','coordenacao','professor'));
create policy escola_disciplina_manager_write on public.escola_disciplinas for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_alocacao_select on public.escola_professor_alocacoes for select to authenticated using (professor_id=auth.uid() or public.escola_can_manage_school(escola_id));
create policy escola_alocacao_manager_write on public.escola_professor_alocacoes for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_grade_select on public.escola_grade_horarios for select to authenticated using (professor_id=auth.uid() or public.escola_can_manage_school(escola_id));
create policy escola_grade_manager_write on public.escola_grade_horarios for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_atividade_select on public.escola_atividades for select to authenticated using (public.escola_can_manage_school(escola_id) or professor_id=auth.uid() or public.escola_can_access_class(turma_id));
create policy escola_atividade_insert on public.escola_atividades for insert to authenticated with check (public.escola_can_manage_school(escola_id) or (professor_id=auth.uid() and public.escola_can_access_class(turma_id)));
create policy escola_atividade_update on public.escola_atividades for update to authenticated using (public.escola_can_manage_school(escola_id) or professor_id=auth.uid()) with check (public.escola_can_manage_school(escola_id) or professor_id=auth.uid());
create policy escola_entrega_select on public.escola_atividade_entregas for select to authenticated using (exists(select 1 from public.escola_atividades a where a.id=atividade_id and (public.escola_can_manage_school(a.escola_id) or a.professor_id=auth.uid() or public.escola_can_access_student(aluno_id))));
create policy escola_entrega_write on public.escola_atividade_entregas for all to authenticated using (exists(select 1 from public.escola_atividades a where a.id=atividade_id and (public.escola_can_manage_school(a.escola_id) or a.professor_id=auth.uid()))) with check (exists(select 1 from public.escola_atividades a where a.id=atividade_id and (public.escola_can_manage_school(a.escola_id) or a.professor_id=auth.uid())));
create policy escola_acompanhamento_select on public.escola_acompanhamentos for select to authenticated using (public.escola_can_manage_school(escola_id) or (visivel_responsavel and exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=aluno_id and ar.responsavel_id=auth.uid())));
create policy escola_acompanhamento_manager_write on public.escola_acompanhamentos for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_reuniao_select on public.escola_reunioes for select to authenticated using (public.escola_can_manage_school(escola_id) or (public.escola_current_role()='professor' and (aluno_id is null or public.escola_can_access_student(aluno_id))) or responsavel_id=auth.uid() or (aluno_id is not null and exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=aluno_id and ar.responsavel_id=auth.uid())));
create policy escola_reuniao_manager_write on public.escola_reunioes for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_comunicado_select on public.escola_comunicados for select to authenticated using (public.escola_same_school(escola_id) and (turma_id is null or public.escola_can_access_class(turma_id)));
create policy escola_comunicado_manager_write on public.escola_comunicados for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_leitura_select on public.escola_comunicado_leituras for select to authenticated using (usuario_id=auth.uid() or exists(select 1 from public.escola_comunicados c where c.id=comunicado_id and public.escola_can_manage_school(c.escola_id)));
create policy escola_leitura_self_write on public.escola_comunicado_leituras for all to authenticated using (usuario_id=auth.uid()) with check (usuario_id=auth.uid());
create policy escola_frequencia_select on public.escola_frequencias for select to authenticated using (public.escola_can_manage_school(escola_id) or exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=aluno_id and ar.responsavel_id=auth.uid()));
create policy escola_frequencia_manager_write on public.escola_frequencias for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_justificativa_select on public.escola_justificativas_falta for select to authenticated using (public.escola_can_manage_school(escola_id) or responsavel_id=auth.uid());
create policy escola_justificativa_self_insert on public.escola_justificativas_falta for insert to authenticated with check (responsavel_id=auth.uid() and public.escola_can_access_student_document(aluno_id));
create policy escola_justificativa_manager_update on public.escola_justificativas_falta for update to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_justarquivo_select on public.escola_justificativa_arquivos for select to authenticated using (public.escola_can_manage_school(escola_id) or responsavel_id=auth.uid());
create policy escola_justarquivo_self_write on public.escola_justificativa_arquivos for all to authenticated using (responsavel_id=auth.uid()) with check (responsavel_id=auth.uid() and public.escola_can_access_student_document(aluno_id));
create policy escola_intercorrencia_staff on public.escola_intercorrencias_grade for select to authenticated using (public.escola_can_manage_school(escola_id) or exists(select 1 from public.escola_grade_horarios g where g.id=grade_id and g.professor_id=auth.uid()));
create policy escola_intercorrencia_manager_write on public.escola_intercorrencias_grade for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_autorizacao_select on public.escola_autorizacoes for select to authenticated using (public.escola_can_manage_school(escola_id) or (public.escola_current_role()='responsavel' and exists(select 1 from public.escola_autorizacao_destinatarios d join public.escola_aluno_responsaveis ar on ar.aluno_id=d.aluno_id and ar.responsavel_id=auth.uid() where d.autorizacao_id=id)));
create policy escola_autorizacao_manager_write on public.escola_autorizacoes for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));
create policy escola_autdest_select on public.escola_autorizacao_destinatarios for select to authenticated using (public.escola_can_manage_school(escola_id) or exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=aluno_id and ar.responsavel_id=auth.uid()));
create policy escola_autresp_select on public.escola_autorizacao_respostas for select to authenticated using (public.escola_can_manage_school(escola_id) or responsavel_id=auth.uid());
create policy escola_authist_select on public.escola_autorizacao_resposta_historico for select to authenticated using (public.escola_can_manage_school(escola_id) or responsavel_id=auth.uid());
create policy escola_ocorrencia_select on public.escola_ocorrencias_aluno for select to authenticated using (public.escola_can_manage_school(escola_id) or (public.escola_current_role()='professor' and public.escola_can_access_student(aluno_id)) or (visivel_responsavel and exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=aluno_id and ar.responsavel_id=auth.uid())));
create policy escola_ciencia_select on public.escola_ocorrencia_ciencias for select to authenticated using (responsavel_id=auth.uid() or exists(select 1 from public.escola_ocorrencias_aluno o where o.id=ocorrencia_id and public.escola_can_manage_school(o.escola_id)));
create policy escola_autorizado_select on public.escola_pessoas_autorizadas for select to authenticated using (public.escola_can_access_student_document(aluno_id));
create policy escola_retirada_select on public.escola_retiradas_aluno for select to authenticated using (public.escola_can_access_student_document(aluno_id));
create policy escola_agenda_select on public.escola_agenda_eventos for select to authenticated using (public.escola_can_manage_school(escola_id) or (public.escola_current_role()='professor' and (turma_id is null or public.escola_can_access_class(turma_id)) and (aluno_id is null or public.escola_can_access_student(aluno_id))) or (visivel_responsavel and (aluno_id is not null and public.escola_can_access_student_document(aluno_id) or aluno_id is null and (turma_id is null and public.escola_same_school(escola_id) or turma_id is not null and public.escola_can_access_class(turma_id))))));
create policy escola_agenda_manager_write on public.escola_agenda_eventos for all to authenticated using (public.escola_can_manage_school(escola_id)) with check (public.escola_can_manage_school(escola_id));

-- Bucket privado de documentos. O layout também o garante por service role.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mba-escola-documentos','mba-escola-documentos',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists mba_escola_documentos_select on storage.objects;
drop policy if exists mba_escola_documentos_insert on storage.objects;
drop policy if exists mba_escola_documentos_update on storage.objects;
drop policy if exists mba_escola_documentos_delete on storage.objects;
create policy mba_escola_documentos_select on storage.objects for select to authenticated using (bucket_id='mba-escola-documentos' and public.escola_can_access_student_document(public.escola_try_uuid((storage.foldername(name))[2])));
create policy mba_escola_documentos_insert on storage.objects for insert to authenticated with check (bucket_id='mba-escola-documentos' and public.escola_can_access_student_document(public.escola_try_uuid((storage.foldername(name))[2])));
create policy mba_escola_documentos_update on storage.objects for update to authenticated using (bucket_id='mba-escola-documentos' and public.escola_can_access_student_document(public.escola_try_uuid((storage.foldername(name))[2]))) with check (bucket_id='mba-escola-documentos' and public.escola_can_access_student_document(public.escola_try_uuid((storage.foldername(name))[2])));
create policy mba_escola_documentos_delete on storage.objects for delete to authenticated using (bucket_id='mba-escola-documentos' and public.escola_can_access_student_document(public.escola_try_uuid((storage.foldername(name))[2])));

-- Permissões PostgREST.
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'escola_%' loop
    execute format('grant select,insert,update,delete on public.%I to authenticated',r.relname);
  end loop;
end $$;

grant execute on function public.escola_is_super_admin() to authenticated;
grant execute on function public.escola_school_dashboard() to authenticated;
grant execute on function public.escola_school_list_classes() to authenticated;
grant execute on function public.escola_school_list_profiles() to authenticated;
grant execute on function public.escola_school_list_students() to authenticated;
grant execute on function public.escola_school_list_guardians() to authenticated;
grant execute on function public.escola_school_list_invites() to authenticated;
grant execute on function public.escola_school_set_profile_active(uuid,boolean) to authenticated;
grant execute on function public.escola_school_upsert_student(uuid,text,date,uuid,boolean) to authenticated;
grant execute on function public.escola_school_upsert_class(uuid,text,integer,text,uuid,boolean) to authenticated;
grant execute on function public.escola_school_create_invite(text,text,text,uuid) to authenticated;
grant execute on function public.escola_school_revoke_invite(uuid) to authenticated;
grant execute on function public.escola_school_student_guardians(uuid) to authenticated;
grant execute on function public.escola_school_link_guardian(uuid,uuid,text,boolean,boolean) to authenticated;
grant execute on function public.escola_school_unlink_guardian(uuid,uuid) to authenticated;
grant execute on function public.escola_school_bulk_import(text,jsonb) to authenticated;
grant execute on function public.escola_school_import_schedule(jsonb,integer) to authenticated;
grant execute on function public.escola_mark_communication(uuid,boolean) to authenticated;
grant execute on function public.escola_register_absence(uuid,date,text) to authenticated;
grant execute on function public.escola_guardian_submit_absence_justification(uuid,text,text) to authenticated;
grant execute on function public.escola_review_absence_justification(uuid,text,text) to authenticated;
grant execute on function public.escola_create_priority_schedule_notice(uuid,date,text,text,time,uuid) to authenticated;
grant execute on function public.escola_create_authorization(text,uuid,uuid[],text,text,text,text,timestamptz,timestamptz,text,boolean) to authenticated;
grant execute on function public.escola_respond_authorization(uuid,uuid,text,text) to authenticated;
grant execute on function public.escola_close_authorization(uuid) to authenticated;
grant execute on function public.escola_create_student_occurrence(uuid,text,text,text,text,text,boolean,boolean) to authenticated;
grant execute on function public.escola_ack_student_occurrence(uuid) to authenticated;
grant execute on function public.escola_manage_authorized_pickup_person(uuid,uuid,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.escola_student_pickup_options(uuid) to authenticated;
grant execute on function public.escola_register_student_pickup(uuid,text,text,uuid,text,text) to authenticated;
grant execute on function public.escola_create_agenda_event(text,text,text,timestamptz,timestamptz,text,text,uuid,uuid,boolean) to authenticated;
grant execute on function public.escola_set_agenda_event_status(uuid,text) to authenticated;
grant execute on function public.escola_agenda_feed(timestamptz,timestamptz,uuid) to authenticated;
grant execute on function public.escola_student_timeline(uuid,integer) to authenticated;

-- A antiga chamada diária não faz parte do produto atual. Remove qualquer overload legado.
do $$ declare r record; begin
  for r in select p.oid::regprocedure::text as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='escola_save_attendance' loop
    execute 'drop function if exists '||r.signature;
  end loop;
end $$;
