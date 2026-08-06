-- MBA Escola: banco separado do Supabase principal da MBA Labs.
-- Escopo do MVP: comunicação, aulas, atividades, reuniões e acompanhamento.

create extension if not exists pgcrypto;

create or replace function public.escola_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create table if not exists public.escola_escolas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  logo_url text,
  status text not null default 'ativa' check (status in ('ativa', 'teste', 'bloqueada', 'cancelada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escola_perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  nome text not null,
  papel text not null check (papel in ('direcao', 'coordenacao', 'professor', 'responsavel')),
  telefone text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_perfis_escola_idx on public.escola_perfis(escola_id);

create table if not exists public.escola_turmas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  nome text not null,
  ano_letivo integer not null,
  turno text check (turno in ('matutino', 'vespertino', 'noturno', 'integral')),
  professor_responsavel_id uuid references public.escola_perfis(id) on delete set null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_turmas_escola_idx on public.escola_turmas(escola_id);

create table if not exists public.escola_alunos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid references public.escola_turmas(id) on delete set null,
  nome text not null,
  data_nascimento date,
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_alunos_escola_idx on public.escola_alunos(escola_id);
create index if not exists escola_alunos_turma_idx on public.escola_alunos(turma_id);

create table if not exists public.escola_aluno_responsaveis (
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  responsavel_id uuid not null references public.escola_perfis(id) on delete cascade,
  parentesco text,
  principal boolean not null default false,
  autorizado_buscar boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (aluno_id, responsavel_id)
);

create index if not exists escola_aluno_responsaveis_responsavel_idx
  on public.escola_aluno_responsaveis(responsavel_id);

create table if not exists public.escola_comunicados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid references public.escola_turmas(id) on delete cascade,
  autor_id uuid not null references public.escola_perfis(id) on delete restrict,
  titulo text not null,
  resumo text,
  conteudo text not null,
  prioridade text not null default 'normal' check (prioridade in ('normal', 'importante', 'urgente')),
  exige_confirmacao boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_comunicados_escola_idx on public.escola_comunicados(escola_id, publicado_em desc);

create table if not exists public.escola_comunicado_leituras (
  comunicado_id uuid not null references public.escola_comunicados(id) on delete cascade,
  perfil_id uuid not null references public.escola_perfis(id) on delete cascade,
  lido_em timestamptz not null default now(),
  confirmado_em timestamptz,
  primary key (comunicado_id, perfil_id)
);

create table if not exists public.escola_aulas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid not null references public.escola_turmas(id) on delete cascade,
  professor_id uuid not null references public.escola_perfis(id) on delete restrict,
  data_aula date not null,
  componente text,
  titulo text not null,
  conteudo_trabalhado text not null,
  tarefa_casa text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_aulas_turma_data_idx on public.escola_aulas(turma_id, data_aula desc);

create table if not exists public.escola_atividades (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  turma_id uuid not null references public.escola_turmas(id) on delete cascade,
  professor_id uuid not null references public.escola_perfis(id) on delete restrict,
  titulo text not null,
  descricao text not null,
  data_entrega date,
  anexo_url text,
  status text not null default 'publicada' check (status in ('rascunho', 'publicada', 'encerrada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_atividades_turma_idx on public.escola_atividades(turma_id, data_entrega);

create table if not exists public.escola_atividade_entregas (
  atividade_id uuid not null references public.escola_atividades(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  situacao text not null default 'pendente' check (situacao in ('pendente', 'entregue', 'atrasada', 'nao_entregue')),
  entregue_em timestamptz,
  comentario_professor text,
  atualizado_em timestamptz not null default now(),
  primary key (atividade_id, aluno_id)
);

create table if not exists public.escola_reunioes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid references public.escola_alunos(id) on delete cascade,
  responsavel_id uuid references public.escola_perfis(id) on delete cascade,
  criado_por uuid not null references public.escola_perfis(id) on delete restrict,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz,
  local text,
  pauta text,
  registro text,
  proximas_acoes text,
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_reunioes_escola_inicio_idx on public.escola_reunioes(escola_id, inicio);

create table if not exists public.escola_acompanhamentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  aluno_id uuid not null references public.escola_alunos(id) on delete cascade,
  autor_id uuid not null references public.escola_perfis(id) on delete restrict,
  categoria text not null check (categoria in ('pedagogico', 'convivencia', 'frequencia', 'comportamento', 'outro')),
  titulo text not null,
  observacao text not null,
  acao_planejada text,
  responsavel_acao text,
  prazo date,
  resultado text,
  status text not null default 'aberto' check (status in ('aberto', 'em_acompanhamento', 'concluido')),
  visivel_responsavel boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists escola_acompanhamentos_aluno_idx on public.escola_acompanhamentos(aluno_id, criado_em desc);

create or replace function public.escola_current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select escola_id from public.escola_perfis where id = auth.uid() and ativo = true limit 1;
$$;

create or replace function public.escola_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.escola_perfis where id = auth.uid() and ativo = true limit 1;
$$;

create or replace function public.escola_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.escola_current_role() in ('direcao', 'coordenacao', 'professor'), false);
$$;

create or replace function public.escola_can_view_student(target_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.escola_alunos aluno
    where aluno.id = target_aluno_id
      and aluno.escola_id = public.escola_current_school_id()
      and (
        public.escola_is_staff()
        or exists (
          select 1
          from public.escola_aluno_responsaveis vinculo
          where vinculo.aluno_id = aluno.id
            and vinculo.responsavel_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.escola_current_school_id() to authenticated;
grant execute on function public.escola_current_role() to authenticated;
grant execute on function public.escola_is_staff() to authenticated;
grant execute on function public.escola_can_view_student(uuid) to authenticated;

alter table public.escola_escolas enable row level security;
alter table public.escola_perfis enable row level security;
alter table public.escola_turmas enable row level security;
alter table public.escola_alunos enable row level security;
alter table public.escola_aluno_responsaveis enable row level security;
alter table public.escola_comunicados enable row level security;
alter table public.escola_comunicado_leituras enable row level security;
alter table public.escola_aulas enable row level security;
alter table public.escola_atividades enable row level security;
alter table public.escola_atividade_entregas enable row level security;
alter table public.escola_reunioes enable row level security;
alter table public.escola_acompanhamentos enable row level security;

create policy escola_escolas_select on public.escola_escolas
for select to authenticated
using (id = public.escola_current_school_id());

create policy escola_perfis_select on public.escola_perfis
for select to authenticated
using (id = auth.uid() or (escola_id = public.escola_current_school_id() and public.escola_is_staff()));

create policy escola_turmas_select on public.escola_turmas
for select to authenticated
using (escola_id = public.escola_current_school_id());

create policy escola_turmas_staff_write on public.escola_turmas
for all to authenticated
using (escola_id = public.escola_current_school_id() and public.escola_is_staff())
with check (escola_id = public.escola_current_school_id() and public.escola_is_staff());

create policy escola_alunos_select on public.escola_alunos
for select to authenticated
using (public.escola_can_view_student(id));

create policy escola_alunos_staff_write on public.escola_alunos
for all to authenticated
using (escola_id = public.escola_current_school_id() and public.escola_is_staff())
with check (escola_id = public.escola_current_school_id() and public.escola_is_staff());

create policy escola_vinculos_select on public.escola_aluno_responsaveis
for select to authenticated
using (responsavel_id = auth.uid() or public.escola_is_staff());

create policy escola_vinculos_staff_write on public.escola_aluno_responsaveis
for all to authenticated
using (public.escola_is_staff())
with check (public.escola_is_staff());

create policy escola_comunicados_select on public.escola_comunicados
for select to authenticated
using (
  escola_id = public.escola_current_school_id()
  and status = 'publicado'
  and (
    turma_id is null
    or public.escola_is_staff()
    or exists (
      select 1
      from public.escola_alunos aluno
      join public.escola_aluno_responsaveis vinculo on vinculo.aluno_id = aluno.id
      where aluno.turma_id = escola_comunicados.turma_id
        and vinculo.responsavel_id = auth.uid()
    )
  )
);

create policy escola_comunicados_staff_write on public.escola_comunicados
for all to authenticated
using (escola_id = public.escola_current_school_id() and public.escola_is_staff())
with check (escola_id = public.escola_current_school_id() and public.escola_is_staff());

create policy escola_leituras_select on public.escola_comunicado_leituras
for select to authenticated
using (perfil_id = auth.uid() or public.escola_is_staff());

create policy escola_leituras_own_write on public.escola_comunicado_leituras
for all to authenticated
using (perfil_id = auth.uid())
with check (perfil_id = auth.uid());

create policy escola_aulas_select on public.escola_aulas
for select to authenticated
using (
  escola_id = public.escola_current_school_id()
  and (
    public.escola_is_staff()
    or exists (
      select 1
      from public.escola_alunos aluno
      join public.escola_aluno_responsaveis vinculo on vinculo.aluno_id = aluno.id
      where aluno.turma_id = escola_aulas.turma_id
        and vinculo.responsavel_id = auth.uid()
    )
  )
);

create policy escola_aulas_staff_write on public.escola_aulas
for all to authenticated
using (escola_id = public.escola_current_school_id() and public.escola_is_staff())
with check (escola_id = public.escola_current_school_id() and public.escola_is_staff());

create policy escola_atividades_select on public.escola_atividades
for select to authenticated
using (
  escola_id = public.escola_current_school_id()
  and (
    public.escola_is_staff()
    or exists (
      select 1
      from public.escola_alunos aluno
      join public.escola_aluno_responsaveis vinculo on vinculo.aluno_id = aluno.id
      where aluno.turma_id = escola_atividades.turma_id
        and vinculo.responsavel_id = auth.uid()
    )
  )
);

create policy escola_atividades_staff_write on public.escola_atividades
for all to authenticated
using (escola_id = public.escola_current_school_id() and public.escola_is_staff())
with check (escola_id = public.escola_current_school_id() and public.escola_is_staff());

create policy escola_entregas_select on public.escola_atividade_entregas
for select to authenticated
using (public.escola_can_view_student(aluno_id));

create policy escola_entregas_staff_write on public.escola_atividade_entregas
for all to authenticated
using (public.escola_is_staff())
with check (public.escola_is_staff());

create policy escola_reunioes_select on public.escola_reunioes
for select to authenticated
using (
  escola_id = public.escola_current_school_id()
  and (public.escola_is_staff() or responsavel_id = auth.uid())
);

create policy escola_reunioes_staff_write on public.escola_reunioes
for all to authenticated
using (escola_id = public.escola_current_school_id() and public.escola_is_staff())
with check (escola_id = public.escola_current_school_id() and public.escola_is_staff());

create policy escola_acompanhamentos_select on public.escola_acompanhamentos
for select to authenticated
using (
  public.escola_can_view_student(aluno_id)
  and (public.escola_is_staff() or visivel_responsavel = true)
);

create policy escola_acompanhamentos_staff_write on public.escola_acompanhamentos
for all to authenticated
using (escola_id = public.escola_current_school_id() and public.escola_is_staff())
with check (escola_id = public.escola_current_school_id() and public.escola_is_staff());

create trigger escola_escolas_updated_at before update on public.escola_escolas
for each row execute function public.escola_set_updated_at();
create trigger escola_perfis_updated_at before update on public.escola_perfis
for each row execute function public.escola_set_updated_at();
create trigger escola_turmas_updated_at before update on public.escola_turmas
for each row execute function public.escola_set_updated_at();
create trigger escola_alunos_updated_at before update on public.escola_alunos
for each row execute function public.escola_set_updated_at();
create trigger escola_comunicados_updated_at before update on public.escola_comunicados
for each row execute function public.escola_set_updated_at();
create trigger escola_aulas_updated_at before update on public.escola_aulas
for each row execute function public.escola_set_updated_at();
create trigger escola_atividades_updated_at before update on public.escola_atividades
for each row execute function public.escola_set_updated_at();
create trigger escola_reunioes_updated_at before update on public.escola_reunioes
for each row execute function public.escola_set_updated_at();
create trigger escola_acompanhamentos_updated_at before update on public.escola_acompanhamentos
for each row execute function public.escola_set_updated_at();
