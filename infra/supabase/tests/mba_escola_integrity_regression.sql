-- MBA Escola: regressão transacional de integridade relacional multi-tenant.
-- Toda mutação é revertida no ROLLBACK final.

begin;

create temporary table qa_integrity_results(
  test_id text primary key,
  passed boolean not null,
  detail text
) on commit drop;

do $$
declare
  v_alfa uuid := (select id from public.escola_escolas where nome='ESCOLA TESTE ALFA');
  v_beta uuid := (select id from public.escola_escolas where nome='ESCOLA TESTE BETA');
  v_admin_alfa uuid := (select id from auth.users where lower(email)='admin.escola.alfa@qa.mbalabs.com.br');
  v_resp_alfa uuid := (select id from auth.users where lower(email)='responsavel.alfa@qa.mbalabs.com.br');

  v_student_beta uuid := (select id from public.escola_alunos where escola_id=v_beta limit 1);
  v_class_beta uuid := (select id from public.escola_turmas where escola_id=v_beta limit 1);
  v_disc_beta uuid := (select id from public.escola_disciplinas where escola_id=v_beta limit 1);
  v_auth_beta uuid := (select id from public.escola_autorizacoes where escola_id=v_beta limit 1);

  v_id uuid;
  v_other_student uuid;
  v_other_class uuid;
  v_occ uuid;
  v_freq uuid;
  v_inter uuid;
  v_msg text;
  v_count bigint;
begin
  select count(*) into v_count from (
    select 1 from public.escola_alunos x join public.escola_turmas r on r.id=x.turma_id where x.turma_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_acompanhamentos x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_agenda_eventos x join public.escola_turmas r on r.id=x.turma_id where x.turma_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_agenda_eventos x join public.escola_alunos r on r.id=x.aluno_id where x.aluno_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_aluno_responsaveis x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_atividades x join public.escola_turmas r on r.id=x.turma_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_autorizacao_destinatarios x join public.escola_autorizacoes r on r.id=x.autorizacao_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_autorizacao_destinatarios x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_autorizacao_respostas x join public.escola_autorizacoes r on r.id=x.autorizacao_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_autorizacao_respostas x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_autorizacao_resposta_historico x join public.escola_autorizacoes r on r.id=x.autorizacao_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_autorizacao_resposta_historico x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_autorizacoes x join public.escola_turmas r on r.id=x.turma_id where x.turma_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_comunicados x join public.escola_turmas r on r.id=x.turma_id where x.turma_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_convites x join public.escola_alunos r on r.id=x.aluno_id where x.aluno_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_frequencias x join public.escola_grade_horarios r on r.id=x.grade_id where x.grade_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_frequencias x join public.escola_turmas r on r.id=x.turma_id where x.turma_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_frequencias x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_grade_horarios x join public.escola_turmas r on r.id=x.turma_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_grade_horarios x join public.escola_disciplinas r on r.id=x.disciplina_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_intercorrencias_grade x join public.escola_grade_horarios r on r.id=x.grade_id where x.grade_id is not null and r.escola_id<>x.escola_id
    union all select 1 from public.escola_intercorrencias_grade x join public.escola_turmas r on r.id=x.turma_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_justificativas_falta x join public.escola_frequencias r on r.id=x.frequencia_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_justificativas_falta x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_ocorrencias_aluno x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_pessoas_autorizadas x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_professor_alocacoes x join public.escola_turmas r on r.id=x.turma_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_professor_alocacoes x join public.escola_disciplinas r on r.id=x.disciplina_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_retiradas_aluno x join public.escola_alunos r on r.id=x.aluno_id where r.escola_id<>x.escola_id
    union all select 1 from public.escola_reunioes x join public.escola_alunos r on r.id=x.aluno_id where x.aluno_id is not null and r.escola_id<>x.escola_id
  ) z;
  insert into qa_integrity_results values ('STATE_01_sem_referencias_cross_tenant',v_count=0,v_count::text);

  begin select id into v_id from public.escola_alunos where escola_id=v_alfa limit 1; update public.escola_alunos set turma_id=v_class_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_01_aluno_turma_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_acompanhamentos where escola_id=v_alfa limit 1; update public.escola_acompanhamentos set aluno_id=v_student_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_02_acompanhamento_aluno_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_agenda_eventos where escola_id=v_alfa limit 1; update public.escola_agenda_eventos set turma_id=v_class_beta,aluno_id=null where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_03_agenda_turma_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_atividades where escola_id=v_alfa limit 1; update public.escola_atividades set turma_id=v_class_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_04_atividade_turma_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_autorizacoes where escola_id=v_alfa limit 1; update public.escola_autorizacoes set turma_id=v_class_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_05_autorizacao_turma_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_comunicados where escola_id=v_alfa limit 1; update public.escola_comunicados set turma_id=v_class_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_06_comunicado_turma_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_frequencias where escola_id=v_alfa limit 1; update public.escola_frequencias set aluno_id=v_student_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_07_frequencia_aluno_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_grade_horarios where escola_id=v_alfa limit 1; update public.escola_grade_horarios set disciplina_id=v_disc_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_08_grade_disciplina_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_professor_alocacoes where escola_id=v_alfa limit 1; update public.escola_professor_alocacoes set turma_id=v_class_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_09_alocacao_turma_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin select id into v_id from public.escola_reunioes where escola_id=v_alfa limit 1; update public.escola_reunioes set aluno_id=v_student_beta where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_10_reuniao_aluno_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  begin insert into public.escola_aluno_responsaveis(escola_id,aluno_id,responsavel_id,parentesco,principal,autorizado_buscar) values(v_alfa,v_student_beta,v_resp_alfa,'QA',false,false); raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_11_vinculo_aluno_beta',v_msg<>'QA_ACCEPTED',v_msg); end;

  if v_auth_beta is not null then
    begin select id into v_id from public.escola_autorizacao_destinatarios where escola_id=v_alfa limit 1; update public.escola_autorizacao_destinatarios set autorizacao_id=v_auth_beta where id=v_id; raise exception 'QA_ACCEPTED';
    exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('TENANT_12_destinatario_autorizacao_beta',v_msg<>'QA_ACCEPTED',v_msg); end;
  end if;

  begin
    insert into public.escola_atividade_entregas(atividade_id,aluno_id,situacao)
    values((select id from public.escola_atividades where escola_id=v_alfa limit 1),v_student_beta,'pendente');
    raise exception 'QA_ACCEPTED';
  exception when others then
    v_msg:=sqlerrm;
    insert into qa_integrity_results values ('TENANT_13_entrega_aluno_beta',v_msg<>'QA_ACCEPTED',v_msg);
  end;

  select j.id into v_id from public.escola_justificativas_falta j where j.escola_id=v_alfa limit 1;
  select a.id into v_other_student from public.escola_alunos a where a.escola_id=v_alfa and a.id<>(select aluno_id from public.escola_justificativas_falta where id=v_id) limit 1;
  begin update public.escola_justificativas_falta set aluno_id=v_other_student where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('INV_01_justificativa_frequencia_aluno',v_msg<>'QA_ACCEPTED',v_msg); end;

  select a.id into v_other_student
  from public.escola_alunos a
  where a.escola_id=v_alfa
    and not exists(select 1 from public.escola_aluno_responsaveis ar where ar.escola_id=v_alfa and ar.aluno_id=a.id and ar.responsavel_id=v_resp_alfa)
  limit 1;
  begin select id into v_id from public.escola_reunioes where escola_id=v_alfa limit 1; update public.escola_reunioes set aluno_id=v_other_student,responsavel_id=v_resp_alfa where id=v_id; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('INV_02_reuniao_responsavel_aluno',v_msg<>'QA_ACCEPTED',v_msg); end;

  select o.id into v_occ
  from public.escola_ocorrencias_aluno o
  where o.escola_id=v_alfa
    and not exists(select 1 from public.escola_aluno_responsaveis ar where ar.escola_id=v_alfa and ar.aluno_id=o.aluno_id and ar.responsavel_id=v_resp_alfa)
  limit 1;
  begin insert into public.escola_ocorrencia_ciencias(ocorrencia_id,responsavel_id,ciente_em) values(v_occ,v_resp_alfa,now()); raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('INV_03_ciencia_responsavel_aluno',v_msg<>'QA_ACCEPTED',v_msg); end;

  select f.id into v_freq from public.escola_frequencias f where f.escola_id=v_alfa and f.grade_id is not null limit 1;
  select t.id into v_other_class from public.escola_turmas t where t.escola_id=v_alfa and t.id<>(select turma_id from public.escola_frequencias where id=v_freq) limit 1;
  begin update public.escola_frequencias set turma_id=v_other_class where id=v_freq; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('INV_04_frequencia_grade_turma',v_msg<>'QA_ACCEPTED',v_msg); end;

  select i.id into v_inter from public.escola_intercorrencias_grade i where i.escola_id=v_alfa and i.grade_id is not null limit 1;
  select t.id into v_other_class from public.escola_turmas t where t.escola_id=v_alfa and t.id<>(select turma_id from public.escola_intercorrencias_grade where id=v_inter) limit 1;
  begin update public.escola_intercorrencias_grade set turma_id=v_other_class where id=v_inter; raise exception 'QA_ACCEPTED';
  exception when others then v_msg:=sqlerrm; insert into qa_integrity_results values ('INV_05_intercorrencia_grade_turma',v_msg<>'QA_ACCEPTED',v_msg); end;

  select count(*) into v_count
  from public.escola_justificativas_falta j
  where not exists(select 1 from public.escola_frequencias f where f.id=j.frequencia_id and f.escola_id=j.escola_id and f.aluno_id=j.aluno_id and f.status='falta')
     or not exists(select 1 from public.escola_aluno_responsaveis ar where ar.escola_id=j.escola_id and ar.aluno_id=j.aluno_id and ar.responsavel_id=j.responsavel_id);
  insert into qa_integrity_results values ('STATE_02_justificativas_coerentes',v_count=0,v_count::text);

  select count(*) into v_count
  from public.escola_reunioes r
  where r.aluno_id is not null and r.responsavel_id is not null
    and not exists(select 1 from public.escola_aluno_responsaveis ar where ar.escola_id=r.escola_id and ar.aluno_id=r.aluno_id and ar.responsavel_id=r.responsavel_id);
  insert into qa_integrity_results values ('STATE_03_reunioes_coerentes',v_count=0,v_count::text);

  select count(*) into v_count
  from public.escola_ocorrencia_ciencias c
  join public.escola_ocorrencias_aluno o on o.id=c.ocorrencia_id
  where not exists(select 1 from public.escola_aluno_responsaveis ar where ar.escola_id=o.escola_id and ar.aluno_id=o.aluno_id and ar.responsavel_id=c.responsavel_id);
  insert into qa_integrity_results values ('STATE_04_ciencias_coerentes',v_count=0,v_count::text);

  select count(*) into v_count
  from public.escola_frequencias f
  join public.escola_grade_horarios g on g.id=f.grade_id
  where f.grade_id is not null and f.turma_id is distinct from g.turma_id;
  insert into qa_integrity_results values ('STATE_05_frequencia_grade_coerente',v_count=0,v_count::text);

  select count(*) into v_count
  from public.escola_intercorrencias_grade i
  join public.escola_grade_horarios g on g.id=i.grade_id
  where i.grade_id is not null and i.turma_id is distinct from g.turma_id;
  insert into qa_integrity_results values ('STATE_06_intercorrencia_grade_coerente',v_count=0,v_count::text);
end $$;

select test_id,passed,detail
from qa_integrity_results
order by test_id;

rollback;
