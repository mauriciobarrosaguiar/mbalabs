-- LexGestor SaaS selling-ready upgrade.
-- Escopo restrito a tabelas lex_* e vínculos necessários ao core já existente.

alter table if exists public.lex_escritorios
  add column if not exists logo_url text,
  add column if not exists watermark_image_url text,
  add column if not exists responsavel_principal text,
  add column if not exists responsavel_oab text,
  add column if not exists modo_demo boolean not null default false,
  add column if not exists preferencias jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.lex_advogados
  add column if not exists whatsapp text,
  add column if not exists perfil_acesso text not null default 'advogado',
  add column if not exists status text not null default 'ativo',
  add column if not exists observacoes text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.lex_casos
  add column if not exists advogado_responsavel_id uuid null references public.lex_advogados(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists lex_advogados_core_usuario_idx on public.lex_advogados(core_usuario_id);
create index if not exists lex_advogados_status_idx on public.lex_advogados(escritorio_id, status);
create index if not exists lex_casos_advogado_responsavel_idx on public.lex_casos(advogado_responsavel_id);
create index if not exists lex_auditoria_escritorio_criado_idx on public.lex_auditoria(escritorio_id, criado_em desc);
