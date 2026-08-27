-- MBA Escola usa autenticação por e-mail e senha; o acesso global permanece
-- restrito ao ADMIN MBA ativo, sem requisito de MFA.

create or replace function public.escola_student_timeline(
  p_aluno_id uuid,
  p_limit integer default 150
)
returns table (
  item_id uuid,
  tipo text,
  titulo text,
  descricao text,
  momento timestamptz,
  status text,
  prioridade text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.escola_current_role();
begin
  if not public.escola_can_access_student(p_aluno_id) then
    raise exception 'Acesso negado';
  end if;

  return query
  select x.item_id, x.tipo, x.titulo, x.descricao, x.momento, x.status, x.prioridade
  from (
    select
      o.id as item_id,
      'ocorrencia'::text as tipo,
      o.titulo,
      o.descricao,
      o.criado_em as momento,
      o.status,
      o.prioridade
    from public.escola_ocorrencias_aluno o
    where o.aluno_id = p_aluno_id
      and (v_role <> 'responsavel' or o.visivel_responsavel)

    union all
    select r.id, 'retirada', 'Retirada do aluno', concat_ws(' · ', r.nome_pessoa, r.motivo), r.retirado_em, 'registrada', 'importante'
    from public.escola_retiradas_aluno r
    where r.aluno_id = p_aluno_id

    union all
    select a.id, 'acompanhamento', a.titulo, a.observacao, a.criado_em, a.status, 'normal'
    from public.escola_acompanhamentos a
    where a.aluno_id = p_aluno_id
      and (v_role <> 'responsavel' or a.visivel_responsavel)

    union all
    select f.id, 'falta', 'Falta registrada', f.observacao, f.criado_em, f.status, 'importante'
    from public.escola_frequencias f
    where f.aluno_id = p_aluno_id
      and f.status = 'falta'

    union all
    select m.id, 'reuniao', m.titulo, m.pauta, m.inicio, m.status, 'normal'
    from public.escola_reunioes m
    where m.aluno_id = p_aluno_id
  ) x
  order by x.momento desc
  limit greatest(1, least(coalesce(p_limit, 150), 500));
end;
$$;

revoke all on function public.escola_student_timeline(uuid, integer) from public;
revoke execute on function public.escola_student_timeline(uuid, integer) from anon;
grant execute on function public.escola_student_timeline(uuid, integer) to authenticated, service_role;

comment on function public.escola_student_timeline(uuid, integer) is
  'Linha do tempo escolar filtrada pelas regras de acesso do aluno.';
