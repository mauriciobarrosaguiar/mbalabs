-- LexGestor: fluxo assistido de tribunais e metadados de anexos.
-- Não cria nem armazena credenciais de tribunais.

create extension if not exists pgcrypto;

alter table if exists public.lex_processos
  add column if not exists sistema_judicial text;

alter table if exists public.lex_documentos
  add column if not exists evento_numero text,
  add column if not exists origem_sistema text;

create table if not exists public.lex_conectores_tribunais (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.lex_escritorios(id) on delete cascade,
  advogado_id uuid references public.lex_advogados(id) on delete set null,
  sistema text not null,
  tribunal text,
  uf text,
  nome text,
  url_base text,
  modo text not null default 'fluxo_assistido',
  status text not null default 'ativo',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lex_conectores_tribunais_escritorio_idx
  on public.lex_conectores_tribunais(escritorio_id);

create index if not exists lex_conectores_tribunais_sistema_idx
  on public.lex_conectores_tribunais(escritorio_id, sistema, tribunal);

create index if not exists lex_documentos_evento_numero_idx
  on public.lex_documentos(escritorio_id, processo_id, evento_numero);

alter table public.lex_conectores_tribunais enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lex_conectores_tribunais'
      and policyname = 'lex_conectores_tribunais_isolamento_escritorio'
  ) then
    create policy "lex_conectores_tribunais_isolamento_escritorio"
    on public.lex_conectores_tribunais
    for all
    using (escritorio_id = public.lex_current_escritorio_id())
    with check (escritorio_id = public.lex_current_escritorio_id());
  end if;
end $$;

notify pgrst, 'reload schema';
