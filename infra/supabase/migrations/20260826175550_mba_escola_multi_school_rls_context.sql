begin;
-- RLS respeita a escola selecionada também nos ramos de professor/responsável.
drop policy if exists escola_acompanhamento_select on public.escola_acompanhamentos;
create policy escola_acompanhamento_select on public.escola_acompanhamentos for select to authenticated using (
  public.escola_can_manage_school(escola_id)
  or (public.escola_same_school(escola_id) and visivel_responsavel and exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id=escola_acompanhamentos.aluno_id and ar.responsavel_id=auth.uid() and ar.escola_id=escola_acompanhamentos.escola_id
  ))
);

drop policy if exists escola_vinculo_select on public.escola_aluno_responsaveis;
create policy escola_vinculo_select on public.escola_aluno_responsaveis for select to authenticated using (
  (responsavel_id=auth.uid() and public.escola_same_school(escola_id)) or public.escola_can_manage_school(escola_id)
);

drop policy if exists escola_entrega_select on public.escola_atividade_entregas;
create policy escola_entrega_select on public.escola_atividade_entregas for select to authenticated using (exists (
  select 1 from public.escola_atividades a
  where a.id=escola_atividade_entregas.atividade_id
    and (public.escola_can_manage_school(a.escola_id) or (a.professor_id=auth.uid() and public.escola_same_school(a.escola_id)) or public.escola_can_access_student(escola_atividade_entregas.aluno_id))
));
drop policy if exists escola_entrega_write on public.escola_atividade_entregas;
create policy escola_entrega_write on public.escola_atividade_entregas for all to authenticated using (exists (
  select 1 from public.escola_atividades a
  where a.id=escola_atividade_entregas.atividade_id
    and (public.escola_can_manage_school(a.escola_id) or (a.professor_id=auth.uid() and public.escola_same_school(a.escola_id)))
)) with check (exists (
  select 1 from public.escola_atividades a
  where a.id=escola_atividade_entregas.atividade_id
    and (public.escola_can_manage_school(a.escola_id) or (a.professor_id=auth.uid() and public.escola_same_school(a.escola_id)))
));

drop policy if exists escola_atividade_insert on public.escola_atividades;
create policy escola_atividade_insert on public.escola_atividades for insert to authenticated with check (
  public.escola_can_manage_school(escola_id) or (professor_id=auth.uid() and public.escola_same_school(escola_id) and public.escola_can_access_class(turma_id))
);
drop policy if exists escola_atividade_select on public.escola_atividades;
create policy escola_atividade_select on public.escola_atividades for select to authenticated using (
  public.escola_can_manage_school(escola_id) or (professor_id=auth.uid() and public.escola_same_school(escola_id)) or public.escola_can_access_class(turma_id)
);
drop policy if exists escola_atividade_update on public.escola_atividades;
create policy escola_atividade_update on public.escola_atividades for update to authenticated using (
  public.escola_can_manage_school(escola_id) or (professor_id=auth.uid() and public.escola_same_school(escola_id))
) with check (
  public.escola_can_manage_school(escola_id) or (professor_id=auth.uid() and public.escola_same_school(escola_id))
);

drop policy if exists escola_autdest_select on public.escola_autorizacao_destinatarios;
create policy escola_autdest_select on public.escola_autorizacao_destinatarios for select to authenticated using (
  public.escola_can_manage_school(escola_id) or (public.escola_same_school(escola_id) and exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id=escola_autorizacao_destinatarios.aluno_id and ar.responsavel_id=auth.uid() and ar.escola_id=escola_autorizacao_destinatarios.escola_id
  ))
);

drop policy if exists escola_authist_select on public.escola_autorizacao_resposta_historico;
create policy escola_authist_select on public.escola_autorizacao_resposta_historico for select to authenticated using (
  public.escola_can_manage_school(escola_id) or (responsavel_id=auth.uid() and public.escola_same_school(escola_id))
);
drop policy if exists escola_autresp_select on public.escola_autorizacao_respostas;
create policy escola_autresp_select on public.escola_autorizacao_respostas for select to authenticated using (
  public.escola_can_manage_school(escola_id) or (responsavel_id=auth.uid() and public.escola_same_school(escola_id))
);

drop policy if exists escola_autorizacao_select on public.escola_autorizacoes;
create policy escola_autorizacao_select on public.escola_autorizacoes for select to authenticated using (
  public.escola_can_manage_school(escola_id)
  or (public.escola_same_school(escola_id) and public.escola_current_role()='responsavel' and exists (
    select 1
    from public.escola_autorizacao_destinatarios d
    join public.escola_aluno_responsaveis ar on ar.aluno_id=d.aluno_id and ar.responsavel_id=auth.uid()
    where d.autorizacao_id=escola_autorizacoes.id and d.escola_id=escola_autorizacoes.escola_id and ar.escola_id=escola_autorizacoes.escola_id
  ))
);

drop policy if exists escola_frequencia_select on public.escola_frequencias;
create policy escola_frequencia_select on public.escola_frequencias for select to authenticated using (
  public.escola_can_manage_school(escola_id) or (public.escola_same_school(escola_id) and exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id=escola_frequencias.aluno_id and ar.responsavel_id=auth.uid() and ar.escola_id=escola_frequencias.escola_id
  ))
);

drop policy if exists escola_grade_select on public.escola_grade_horarios;
create policy escola_grade_select on public.escola_grade_horarios for select to authenticated using (
  (professor_id=auth.uid() and public.escola_same_school(escola_id)) or public.escola_can_manage_school(escola_id)
);

drop policy if exists escola_intercorrencia_staff on public.escola_intercorrencias_grade;
create policy escola_intercorrencia_staff on public.escola_intercorrencias_grade for select to authenticated using (
  public.escola_can_manage_school(escola_id) or (public.escola_same_school(escola_id) and exists (
    select 1 from public.escola_grade_horarios g where g.id=escola_intercorrencias_grade.grade_id and g.professor_id=auth.uid()
  ))
);

drop policy if exists escola_justarquivo_select on public.escola_justificativa_arquivos;
create policy escola_justarquivo_select on public.escola_justificativa_arquivos for select to authenticated using (
  excluido_em is null and (
    public.escola_can_manage_school(escola_id)
    or (public.escola_same_school(escola_id) and responsavel_id=auth.uid() and exists (
      select 1 from public.escola_aluno_responsaveis ar
      where ar.escola_id=escola_justificativa_arquivos.escola_id and ar.aluno_id=escola_justificativa_arquivos.aluno_id and ar.responsavel_id=auth.uid()
    ))
  )
);
drop policy if exists escola_justarquivo_self_insert on public.escola_justificativa_arquivos;
create policy escola_justarquivo_self_insert on public.escola_justificativa_arquivos for insert to authenticated with check (
  responsavel_id=auth.uid() and public.escola_same_school(escola_id) and excluido_em is null and public.escola_document_upload_allowed(storage_path)
);

drop policy if exists escola_justificativa_select on public.escola_justificativas_falta;
create policy escola_justificativa_select on public.escola_justificativas_falta for select to authenticated using (
  public.escola_can_manage_school(escola_id) or (responsavel_id=auth.uid() and public.escola_same_school(escola_id))
);
drop policy if exists escola_justificativa_self_insert on public.escola_justificativas_falta;
create policy escola_justificativa_self_insert on public.escola_justificativas_falta for insert to authenticated with check (
  responsavel_id=auth.uid() and public.escola_same_school(escola_id) and public.escola_can_access_student_document(aluno_id)
);

drop policy if exists escola_ciencia_select on public.escola_ocorrencia_ciencias;
create policy escola_ciencia_select on public.escola_ocorrencia_ciencias for select to authenticated using (
  (responsavel_id=auth.uid() and exists (
    select 1 from public.escola_ocorrencias_aluno o where o.id=escola_ocorrencia_ciencias.ocorrencia_id and public.escola_same_school(o.escola_id)
  )) or exists (
    select 1 from public.escola_ocorrencias_aluno o where o.id=escola_ocorrencia_ciencias.ocorrencia_id and public.escola_can_manage_school(o.escola_id)
  )
);

drop policy if exists escola_ocorrencia_select on public.escola_ocorrencias_aluno;
create policy escola_ocorrencia_select on public.escola_ocorrencias_aluno for select to authenticated using (
  public.escola_can_manage_school(escola_id)
  or (public.escola_same_school(escola_id) and public.escola_current_role()='professor' and public.escola_can_access_student(aluno_id))
  or (public.escola_same_school(escola_id) and visivel_responsavel and exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id=escola_ocorrencias_aluno.aluno_id and ar.responsavel_id=auth.uid() and ar.escola_id=escola_ocorrencias_aluno.escola_id
  ))
);

drop policy if exists escola_alocacao_select on public.escola_professor_alocacoes;
create policy escola_alocacao_select on public.escola_professor_alocacoes for select to authenticated using (
  (professor_id=auth.uid() and public.escola_same_school(escola_id)) or public.escola_can_manage_school(escola_id)
);

drop policy if exists escola_reuniao_select on public.escola_reunioes;
create policy escola_reuniao_select on public.escola_reunioes for select to authenticated using (
  public.escola_can_manage_school(escola_id)
  or (public.escola_same_school(escola_id) and public.escola_current_role()='professor' and (aluno_id is null or public.escola_can_access_student(aluno_id)))
  or (responsavel_id=auth.uid() and public.escola_same_school(escola_id))
  or (public.escola_same_school(escola_id) and aluno_id is not null and exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id=escola_reunioes.aluno_id and ar.responsavel_id=auth.uid() and ar.escola_id=escola_reunioes.escola_id
  ))
);
commit;
