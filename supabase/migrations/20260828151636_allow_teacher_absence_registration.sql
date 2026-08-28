-- Permite ao professor registrar falta somente para alunos que ele já pode
-- acessar pelas alocações ativas da escola selecionada.

create or replace function public.escola_register_absence(
  p_aluno_id uuid,
  p_data_aula date,
  p_observacao text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escola uuid := public.escola_current_school_id();
  v_turma uuid;
  v_id uuid;
  v_role text := public.escola_current_role();
begin
  if not public.escola_can_manage_school(v_escola)
     and not (v_role = 'professor' and public.escola_can_access_student(p_aluno_id)) then
    raise exception 'Acesso negado';
  end if;

  select turma_id
    into v_turma
    from public.escola_alunos
   where id = p_aluno_id
     and escola_id = v_escola
     and ativo;

  if not found then
    raise exception 'Aluno não encontrado';
  end if;

  insert into public.escola_frequencias(
    escola_id,
    grade_id,
    turma_id,
    aluno_id,
    data_aula,
    status,
    observacao,
    registrado_por
  ) values (
    v_escola,
    null,
    v_turma,
    p_aluno_id,
    p_data_aula,
    'falta',
    p_observacao,
    auth.uid()
  )
  on conflict (aluno_id, data_aula) where status = 'falta'
  do update
    set observacao = excluded.observacao,
        atualizado_em = now()
  returning id into v_id;

  return v_id;
end;
$$;
