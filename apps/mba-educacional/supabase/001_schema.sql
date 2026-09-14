-- MBA Educação · Fase 1
-- Migração preparada, NÃO aplicada automaticamente.
-- Prefixo edu_ para coexistir com o Supabase único do MBA Labs.

create table if not exists public.edu_instituicoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('mba_educacao','ies','escola_tecnica','produtor_conteudo')),
  cnpj text,
  status text not null default 'rascunho' check (status in ('rascunho','ativa','inativa')),
  logo_url text,
  portal_url text,
  integracao_tipo text not null default 'manual' check (integracao_tipo in ('manual','link','sso','api')),
  created_at timestamptz not null default now()
);

create table if not exists public.edu_cursos (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid references public.edu_instituicoes(id),
  slug text not null unique,
  titulo text not null,
  descricao text,
  tipo text not null check (tipo in ('rapido','profissionalizante','pos','tecnico')),
  categoria text,
  carga_horaria integer,
  preco_centavos integer,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','inativo')),
  ambiente_estudo text not null default 'mba_lms' check (ambiente_estudo in ('mba_lms','portal_parceiro','hibrido')),
  certificacao text not null default 'mba' check (certificacao in ('mba','parceiro_upload','parceiro_link','parceiro_api')),
  certificado_portal_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edu_modulos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.edu_cursos(id) on delete cascade,
  titulo text not null,
  ordem integer not null default 0
);

create table if not exists public.edu_aulas (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.edu_modulos(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'video' check (tipo in ('video','texto','pdf','link','avaliacao')),
  conteudo_url text,
  duracao_minutos integer,
  ordem integer not null default 0,
  obrigatoria boolean not null default true
);

create table if not exists public.edu_matriculas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  curso_id uuid not null references public.edu_cursos(id),
  status text not null default 'ativa' check (status in ('pendente','ativa','concluida','cancelada')),
  parceiro_matricula_id text,
  matriculado_em timestamptz not null default now(),
  concluido_em timestamptz,
  unique (usuario_id, curso_id)
);

create table if not exists public.edu_progresso (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.edu_matriculas(id) on delete cascade,
  aula_id uuid not null references public.edu_aulas(id) on delete cascade,
  concluida boolean not null default false,
  percentual numeric(5,2) not null default 0,
  segundos_assistidos integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (matricula_id, aula_id)
);

create table if not exists public.edu_certificados (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null unique references public.edu_matriculas(id) on delete cascade,
  emissor_instituicao_id uuid references public.edu_instituicoes(id),
  codigo_validacao text not null unique,
  documento_url text,
  portal_externo_url text,
  status text not null default 'pendente' check (status in ('pendente','emitido','revogado')),
  emitido_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists edu_cursos_tipo_idx on public.edu_cursos(tipo);
create index if not exists edu_cursos_status_idx on public.edu_cursos(status);
create index if not exists edu_matriculas_usuario_idx on public.edu_matriculas(usuario_id);

alter table public.edu_instituicoes enable row level security;
alter table public.edu_cursos enable row level security;
alter table public.edu_modulos enable row level security;
alter table public.edu_aulas enable row level security;
alter table public.edu_matriculas enable row level security;
alter table public.edu_progresso enable row level security;
alter table public.edu_certificados enable row level security;

-- Políticas serão adicionadas quando os perfis (admin, aluno, parceiro) forem conectados
-- ao login único do MBA Labs. Não liberar acesso público às tabelas privadas nesta fase.
