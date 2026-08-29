-- MBA Escola: reuniões direcionadas a um responsável não podem aparecer
-- para outro responsável apenas porque ambos estão vinculados ao mesmo aluno.

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
    responsavel_id is null
    and public.escola_same_school(escola_id)
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
  if v_escola is null then raise exception 'Perfil escolar inválido'; end if;

  if p_aluno_id is not null then
    if not public.escola_can_access_student(p_aluno_id) then raise exception 'Acesso negado'; end if;
    select a.turma_id into v_turma from public.escola_alunos a where a.id = p_aluno_id;
  end if;
  if v_role = 'responsavel' and p_aluno_id is null then raise exception 'Selecione um aluno'; end if;

  return query
  select e.id,'evento'::text,e.titulo,e.descricao,e.inicio,e.fim,e.local,e.prioridade,e.aluno_id,e.turma_id,e.status
  from public.escola_agenda_eventos e
  where e.escola_id=v_escola and e.inicio>=p_inicio and e.inicio<p_fim
    and (p_aluno_id is null or e.aluno_id=p_aluno_id or (e.aluno_id is null and (e.turma_id is null or e.turma_id=v_turma)))
    and (
      v_role in ('admin_escola','direcao','coordenacao')
      or (v_role='professor' and ((e.aluno_id is not null and public.escola_can_access_student(e.aluno_id)) or (e.aluno_id is null and (e.turma_id is null or public.escola_can_access_class(e.turma_id)))))
      or (v_role='responsavel' and e.visivel_responsavel)
    )
  union all
  select r.id,'reuniao',r.titulo,r.pauta,r.inicio,r.fim,r.local,'importante',r.aluno_id,null::uuid,r.status
  from public.escola_reunioes r
  where r.escola_id=v_escola and r.inicio>=p_inicio and r.inicio<p_fim
    and (p_aluno_id is null or r.aluno_id=p_aluno_id)
    and (
      v_role in ('admin_escola','direcao','coordenacao')
      or (v_role='professor' and ((r.aluno_id is null and r.responsavel_id is null) or (r.aluno_id is not null and public.escola_can_access_student(r.aluno_id))))
      or (v_role='responsavel' and (r.responsavel_id=auth.uid() or (r.responsavel_id is null and r.aluno_id is not null and public.escola_can_access_student(r.aluno_id))))
    )
  union all
  select a.id,'atividade',a.titulo,a.descricao,(a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina',null::timestamptz,null::text,'normal',p_aluno_id,a.turma_id,a.status
  from public.escola_atividades a
  where a.escola_id=v_escola and a.data_entrega is not null
    and ((a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina')>=p_inicio
    and ((a.data_entrega::timestamp + interval '18 hours') at time zone 'America/Araguaina')<p_fim
    and (p_aluno_id is null or a.turma_id=v_turma)
    and (v_role in ('admin_escola','direcao','coordenacao') or (v_role='professor' and a.professor_id=auth.uid()) or (v_role='responsavel' and public.escola_can_access_class(a.turma_id)))
  union all
  select au.id,'autorizacao',au.titulo,au.descricao,au.data_evento,null::timestamptz,au.local,au.prioridade,p_aluno_id,au.turma_id,au.status
  from public.escola_autorizacoes au
  where au.escola_id=v_escola and au.data_evento is not null and au.data_evento>=p_inicio and au.data_evento<p_fim
    and (p_aluno_id is null or exists(select 1 from public.escola_autorizacao_destinatarios d where d.autorizacao_id=au.id and d.aluno_id=p_aluno_id))
    and v_role in ('admin_escola','direcao','coordenacao','responsavel');
end;
$$;

create or replace function public.escola_student_timeline(p_aluno_id uuid, p_limit integer default 150)
returns table(item_id uuid,tipo text,titulo text,descricao text,momento timestamptz,status text,prioridade text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_role text := public.escola_current_role();
begin
  if not public.escola_can_access_student(p_aluno_id) then raise exception 'Acesso negado'; end if;

  return query
  select x.item_id,x.tipo,x.titulo,x.descricao,x.momento,x.status,x.prioridade
  from (
    select o.id,'ocorrencia'::text,o.titulo,o.descricao,o.criado_em,o.status,o.prioridade
    from public.escola_ocorrencias_aluno o
    where o.aluno_id=p_aluno_id and (v_role<>'responsavel' or o.visivel_responsavel)
    union all
    select r.id,'retirada','Retirada do aluno',concat_ws(' · ',r.nome_pessoa,r.motivo),r.retirado_em,'registrada','importante'
    from public.escola_retiradas_aluno r where r.aluno_id=p_aluno_id
    union all
    select a.id,'acompanhamento',a.titulo,a.observacao,a.criado_em,a.status,'normal'
    from public.escola_acompanhamentos a
    where a.aluno_id=p_aluno_id and (v_role<>'responsavel' or a.visivel_responsavel)
    union all
    select f.id,'falta','Falta registrada',f.observacao,f.criado_em,f.status,'importante'
    from public.escola_frequencias f where f.aluno_id=p_aluno_id and f.status='falta'
    union all
    select m.id,'reuniao',m.titulo,m.pauta,m.inicio,m.status,'normal'
    from public.escola_reunioes m
    where m.aluno_id=p_aluno_id and (v_role<>'responsavel' or m.responsavel_id is null or m.responsavel_id=auth.uid())
  ) x
  order by x.momento desc
  limit greatest(1,least(coalesce(p_limit,150),500));
end;
$$;
