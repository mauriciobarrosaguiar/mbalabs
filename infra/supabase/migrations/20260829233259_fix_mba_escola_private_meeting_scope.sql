-- MBA Escola: fecha vazamento de reuniões privadas e contagens multi-escola.

drop policy if exists escola_reuniao_select on public.escola_reunioes;
create policy escola_reuniao_select on public.escola_reunioes
for select to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or (
    public.escola_same_school(escola_id)
    and public.escola_current_role() = 'professor'
    and (
      (aluno_id is null and responsavel_id is null)
      or (aluno_id is not null and public.escola_can_access_student(aluno_id))
    )
  )
  or (responsavel_id = auth.uid() and public.escola_same_school(escola_id))
  or (
    public.escola_same_school(escola_id)
    and aluno_id is not null
    and exists (
      select 1
      from public.escola_aluno_responsaveis ar
      where ar.aluno_id = escola_reunioes.aluno_id
        and ar.responsavel_id = auth.uid()
        and ar.escola_id = escola_reunioes.escola_id
    )
  )
);

create or replace function public.escola_agenda_feed(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_aluno_id uuid default null
)
returns table(
  evento_id uuid,
  fonte text,
  titulo text,
  descricao text,
  inicio timestamptz,
  fim timestamptz,
  local text,
  prioridade text,
  aluno_id uuid,
  turma_id uuid,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_escola uuid := public.escola_current_school_id();
  v_role text := public.escola_current_role();
  v_turma uuid;
begin
  if public.escola_is_super_admin() and v_escola is null then
    raise exception 'Selecione uma escola para a agenda';
  end if;

  if v_escola is null then
    raise exception 'Perfil escolar inválido';
  end if;

  if p_aluno_id is not null then
    if not public.escola_can_access_student(p_aluno_id) then
      raise exception 'Acesso negado';
    end if;

    select a.turma_id
      into v_turma
      from public.escola_alunos a
     where a.id = p_aluno_id;
  end if;

  if v_role = 'responsavel' and p_aluno_id is null then
    raise exception 'Selecione um aluno';
  end if;

  return query
  select
    e.id,
    'evento'::text,
    e.titulo,
    e.descricao,
    e.inicio,
    e.fim,
    e.local,
    e.prioridade,
    e.aluno_id,
    e.turma_id,
    e.status
  from public.escola_agenda_eventos e
  where e.escola_id = v_escola
    and e.inicio >= p_inicio
    and e.inicio < p_fim
    and (
      p_aluno_id is null
      or e.aluno_id = p_aluno_id
      or (
        e.aluno_id is null
        and (e.turma_id is null or e.turma_id = v_turma)
      )
    )
    and (
      v_role in ('admin_escola', 'direcao', 'coordenacao')
      or (
        v_role = 'professor'
        and (
          (
            e.aluno_id is not null
            and public.escola_can_access_student(e.aluno_id)
          )
          or (
            e.aluno_id is null
            and (
              e.turma_id is null
              or public.escola_can_access_class(e.turma_id)
            )
          )
        )
      )
      or (v_role = 'responsavel' and e.visivel_responsavel)
    )

  union all

  select
    r.id,
    'reuniao',
    r.titulo,
    r.pauta,
    r.inicio,
    r.fim,
    r.local,
    'importante',
    r.aluno_id,
    null::uuid,
    r.status
  from public.escola_reunioes r
  where r.escola_id = v_escola
    and r.inicio >= p_inicio
    and r.inicio < p_fim
    and (p_aluno_id is null or r.aluno_id = p_aluno_id)
    and (
      v_role in ('admin_escola', 'direcao', 'coordenacao')
      or (
        v_role = 'professor'
        and (
          (r.aluno_id is null and r.responsavel_id is null)
          or (
            r.aluno_id is not null
            and public.escola_can_access_student(r.aluno_id)
          )
        )
      )
      or (
        v_role = 'responsavel'
        and (
          r.responsavel_id = auth.uid()
          or (
            r.aluno_id is not null
            and public.escola_can_access_student(r.aluno_id)
          )
        )
      )
    )

  union all

  select
    a.id,
    'atividade',
    a.titulo,
    a.descricao,
    (a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina',
    null::timestamptz,
    null::text,
    'normal',
    p_aluno_id,
    a.turma_id,
    a.status
  from public.escola_atividades a
  where a.escola_id = v_escola
    and a.data_entrega is not null
    and ((a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina') >= p_inicio
    and ((a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina') < p_fim
    and (p_aluno_id is null or a.turma_id = v_turma)
    and (
      v_role in ('admin_escola', 'direcao', 'coordenacao')
      or (v_role = 'professor' and a.professor_id = auth.uid())
      or (
        v_role = 'responsavel'
        and public.escola_can_access_class(a.turma_id)
      )
    )

  union all

  select
    au.id,
    'autorizacao',
    au.titulo,
    au.descricao,
    au.data_evento,
    null::timestamptz,
    au.local,
    au.prioridade,
    p_aluno_id,
    au.turma_id,
    au.status
  from public.escola_autorizacoes au
  where au.escola_id = v_escola
    and au.data_evento is not null
    and au.data_evento >= p_inicio
    and au.data_evento < p_fim
    and (
      p_aluno_id is null
      or exists (
        select 1
        from public.escola_autorizacao_destinatarios d
        where d.autorizacao_id = au.id
          and d.aluno_id = p_aluno_id
      )
    )
    and v_role in ('admin_escola', 'direcao', 'coordenacao', 'responsavel');
end;
$$;

create or replace function public.escola_school_list_guardians()
returns table(id uuid, nome text, email text, telefone text, ativo boolean, total_alunos bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    p.id,
    p.nome,
    p.email,
    p.telefone,
    p.ativo,
    (
      select count(*)
      from public.escola_aluno_responsaveis ar
      where ar.responsavel_id = p.id
        and ar.escola_id = v_escola
    )
  from public.escola_perfis p
  where p.escola_id = v_escola
    and p.papel = 'responsavel'
  order by p.nome;
end;
$$;

create or replace function public.escola_school_list_students()
returns table(id uuid, nome text, data_nascimento date, turma_id uuid, turma_nome text, ativo boolean, total_responsaveis bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_escola uuid := public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    a.id,
    a.nome,
    a.data_nascimento,
    a.turma_id,
    t.nome,
    a.ativo,
    (
      select count(*)
      from public.escola_aluno_responsaveis ar
      where ar.aluno_id = a.id
        and ar.escola_id = v_escola
    )
  from public.escola_alunos a
  left join public.escola_turmas t on t.id = a.turma_id
  where a.escola_id = v_escola
  order by a.nome;
end;
$$;
