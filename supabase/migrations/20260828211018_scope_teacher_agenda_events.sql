-- Impede que professores vejam eventos individuais de alunos fora de suas
-- turmas. Eventos gerais da escola continuam visiveis ao professor.

create or replace function public.escola_agenda_feed(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_aluno_id uuid default null
)
returns table (
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
set search_path = public
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
          r.aluno_id is null
          or public.escola_can_access_student(r.aluno_id)
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
    and (
      (a.data_entrega::timestamp + interval '18 hours')
      at time zone 'America/Araguaina'
    ) >= p_inicio
    and (
      (a.data_entrega::timestamp + interval '18 hours')
      at time zone 'America/Araguaina'
    ) < p_fim
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

revoke all on function public.escola_agenda_feed(timestamptz, timestamptz, uuid) from public;
revoke execute on function public.escola_agenda_feed(timestamptz, timestamptz, uuid) from anon;
grant execute on function public.escola_agenda_feed(timestamptz, timestamptz, uuid) to authenticated, service_role;

comment on function public.escola_agenda_feed(timestamptz, timestamptz, uuid) is
  'Agenda escolar filtrada por tenant e pelo escopo real do perfil autenticado.';
