-- MBA Escola: regressão transacional dos principais limites de tenant e papel.
-- Pré-requisito: ambiente QA com os usuários e escolas TESTE já provisionados.
-- Toda mutação é revertida no ROLLBACK final.

begin;

create temporary table qa_users as
select id, lower(email) as email
from auth.users
where lower(email) like '%@qa.mbalabs.com.br';

create temporary table qa_schools as
select id, nome
from public.escola_escolas
where nome in ('ESCOLA TESTE ALFA','ESCOLA TESTE BETA','ESCOLA TESTE INATIVA');

create temporary table qa_docs as
select distinct on (escola_id) escola_id, storage_path
from public.escola_justificativa_arquivos
where excluido_em is null
order by escola_id, criado_em;

create temporary table qa_results(
  test_id text primary key,
  passed boolean not null,
  detail text
) on commit drop;

grant select on qa_users, qa_schools, qa_docs to authenticated;
grant select, insert, update, delete on qa_results to authenticated;

set local role authenticated;

do $$
declare
  v_alfa uuid := (select id from qa_schools where nome='ESCOLA TESTE ALFA');
  v_beta uuid := (select id from qa_schools where nome='ESCOLA TESTE BETA');
  v_admin_alfa uuid := (select id from qa_users where email='admin.escola.alfa@qa.mbalabs.com.br');
  v_coord_alfa uuid := (select id from qa_users where email='coordenacao.alfa@qa.mbalabs.com.br');
  v_prof_alfa uuid := (select id from qa_users where email='professor.alfa@qa.mbalabs.com.br');
  v_prof_sem uuid := (select id from qa_users where email='professor.sem.turma.alfa@qa.mbalabs.com.br');
  v_prof_multi uuid := (select id from qa_users where email='professor.multi@qa.mbalabs.com.br');
  v_resp_alfa uuid := (select id from qa_users where email='responsavel.alfa@qa.mbalabs.com.br');
  v_resp2_alfa uuid := (select id from qa_users where email='responsavel2.alfa@qa.mbalabs.com.br');
  v_resp_beta uuid := (select id from qa_users where email='responsavel.beta@qa.mbalabs.com.br');
  v_inativo uuid := (select id from qa_users where email='inativo.alfa@qa.mbalabs.com.br');
  v_admin_inativa uuid := (select id from qa_users where email='admin.escola.inativa@qa.mbalabs.com.br');
  v_count int;
  v_school uuid;
  v_doc_alfa text := (select storage_path from qa_docs where escola_id=v_alfa);
  v_doc_beta text := (select storage_path from qa_docs where escola_id=v_beta);
  v_invite uuid;
  v_shared_student uuid;
  v_private_meeting uuid;
  v_shared_meeting uuid;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);

  perform set_config('request.jwt.claim.sub',v_admin_alfa::text,true);
  v_school := public.escola_current_school_id();
  insert into qa_results values ('ADMIN_01_contexto_alfa', v_school=v_alfa, coalesce(v_school::text,'NULL'));
  insert into qa_results values ('ADMIN_02_pode_administrar_alfa', public.escola_can_admin_school(v_alfa), null);

  begin
    perform public.escola_select_school(v_beta);
    insert into qa_results values ('ADMIN_03_bloqueia_selecao_beta', false, 'seleção indevida aceita');
  exception when others then
    insert into qa_results values ('ADMIN_03_bloqueia_selecao_beta', true, sqlerrm);
  end;

  select count(*) into v_count from public.escola_alunos where escola_id=v_beta;
  insert into qa_results values ('ADMIN_04_rls_sem_alunos_beta', v_count=0, v_count::text);

  perform set_config('request.jwt.claim.sub',v_coord_alfa::text,true);
  insert into qa_results values ('COORD_01_gerencia_alfa', public.escola_can_manage_school(v_alfa), null);
  insert into qa_results values ('COORD_02_nao_administra_perfis', not public.escola_can_admin_school(v_alfa), null);
  select count(*) into v_count from public.escola_alunos where escola_id=v_beta;
  insert into qa_results values ('COORD_03_rls_sem_alunos_beta', v_count=0, v_count::text);

  perform set_config('request.jwt.claim.sub',v_prof_alfa::text,true);
  select count(*) into v_count
  from public.escola_alunos a
  where a.escola_id=v_alfa and public.escola_can_access_student(a.id);
  insert into qa_results values ('PROF_01_tem_alunos_no_escopo', v_count>0, v_count::text);

  select count(*) into v_count
  from public.escola_alunos a
  where a.escola_id=v_beta and public.escola_can_access_student(a.id);
  insert into qa_results values ('PROF_02_sem_alunos_beta', v_count=0, v_count::text);

  perform set_config('request.jwt.claim.sub',v_prof_sem::text,true);
  select count(*) into v_count
  from public.escola_alunos a
  where public.escola_can_access_student(a.id);
  insert into qa_results values ('PROFSEM_01_sem_alunos', v_count=0, v_count::text);

  perform set_config('request.jwt.claim.sub',v_prof_multi::text,true);
  select count(*) into v_count from public.escola_my_memberships();
  insert into qa_results values ('MULTI_01_duas_matriculas', v_count=2, v_count::text);

  perform public.escola_select_school(v_alfa);
  v_school := public.escola_current_school_id();
  insert into qa_results values ('MULTI_02_contexto_alfa', v_school=v_alfa, coalesce(v_school::text,'NULL'));

  perform public.escola_select_school(v_beta);
  v_school := public.escola_current_school_id();
  insert into qa_results values ('MULTI_03_contexto_beta', v_school=v_beta, coalesce(v_school::text,'NULL'));

  perform set_config('request.jwt.claim.sub',v_resp_alfa::text,true);
  select count(*) into v_count
  from public.escola_alunos a
  where public.escola_can_access_student(a.id);
  insert into qa_results values ('RESP_01_tem_filhos_vinculados', v_count>0, v_count::text);

  select count(*) into v_count
  from public.escola_alunos a
  where a.escola_id=v_beta and public.escola_can_access_student(a.id);
  insert into qa_results values ('RESP_02_sem_aluno_beta', v_count=0, v_count::text);

  insert into qa_results values ('DOC_01_resp_alfa_le_proprio', v_doc_alfa is not null and public.escola_document_read_allowed(v_doc_alfa), coalesce(v_doc_alfa,'sem documento Alfa'));
  insert into qa_results values ('DOC_02_resp_alfa_bloqueia_beta', v_doc_beta is not null and not public.escola_document_read_allowed(v_doc_beta), coalesce(v_doc_beta,'sem documento Beta'));

  perform set_config('request.jwt.claim.sub',v_resp_beta::text,true);
  insert into qa_results values ('DOC_03_resp_beta_bloqueia_alfa', v_doc_alfa is not null and not public.escola_document_read_allowed(v_doc_alfa), coalesce(v_doc_alfa,'sem documento Alfa'));
  insert into qa_results values ('DOC_04_resp_beta_le_proprio', v_doc_beta is not null and public.escola_document_read_allowed(v_doc_beta), coalesce(v_doc_beta,'sem documento Beta'));

  -- Dois responsáveis do mesmo aluno: reunião direcionada a um deles deve ser privada.
  select ar1.aluno_id into v_shared_student
  from public.escola_aluno_responsaveis ar1
  join public.escola_aluno_responsaveis ar2 on ar2.aluno_id=ar1.aluno_id and ar2.escola_id=ar1.escola_id
  where ar1.escola_id=v_alfa
    and ar1.responsavel_id=v_resp_alfa
    and ar2.responsavel_id=v_resp2_alfa
  limit 1;

  perform set_config('request.jwt.claim.sub',v_admin_alfa::text,true);
  insert into public.escola_reunioes(escola_id,aluno_id,responsavel_id,criado_por,titulo,inicio,status)
  values(v_alfa,v_shared_student,v_resp_alfa,v_admin_alfa,'QA PRIVADA RESPONSAVEL 1',now()+interval '1 day','agendada')
  returning id into v_private_meeting;

  insert into public.escola_reunioes(escola_id,aluno_id,responsavel_id,criado_por,titulo,inicio,status)
  values(v_alfa,v_shared_student,null,v_admin_alfa,'QA REUNIAO COMPARTILHADA ALUNO',now()+interval '2 days','agendada')
  returning id into v_shared_meeting;

  perform set_config('request.jwt.claim.sub',v_resp2_alfa::text,true);
  select count(*) into v_count from public.escola_reunioes where id=v_private_meeting;
  insert into qa_results values ('MEETING_01_resp2_nao_ve_privada_resp1', v_count=0, v_count::text);

  select count(*) into v_count from public.escola_student_timeline(v_shared_student) t where t.item_id=v_private_meeting;
  insert into qa_results values ('MEETING_02_timeline_nao_vaza_privada', v_count=0, v_count::text);

  select count(*) into v_count from public.escola_reunioes where id=v_shared_meeting;
  insert into qa_results values ('MEETING_03_resp2_ve_reuniao_compartilhada', v_count=1, v_count::text);

  perform set_config('request.jwt.claim.sub',v_inativo::text,true);
  v_school := public.escola_current_school_id();
  insert into qa_results values ('INATIVO_01_sem_contexto', v_school is null, coalesce(v_school::text,'NULL'));

  perform set_config('request.jwt.claim.sub',v_admin_inativa::text,true);
  v_school := public.escola_current_school_id();
  insert into qa_results values ('ESCINATIVA_01_sem_contexto', v_school is null, coalesce(v_school::text,'NULL'));

  perform set_config('request.jwt.claim.sub',v_admin_alfa::text,true);
  v_invite := public.escola_school_create_invite('QA REGRESSAO','qa.regressao.tmp@example.invalid','professor',null);
  insert into qa_results values ('CONVITE_01_criar', v_invite is not null, coalesce(v_invite::text,'NULL'));

  perform public.escola_school_revoke_invite(v_invite);
  select count(*) into v_count from public.escola_convites where id=v_invite and status='revogado';
  insert into qa_results values ('CONVITE_02_revogar', v_count=1, v_count::text);

  begin
    insert into public.escola_auditoria(escola_id,ator_id,ator_tipo,acao,recurso,detalhes)
    values(v_alfa,v_admin_alfa,'admin_escola','qa_forjado','qa_forjado','{}'::jsonb);
    insert into qa_results values ('AUDIT_01_append_only', false, 'insert direto aceito');
  exception when others then
    insert into qa_results values ('AUDIT_01_append_only', true, sqlerrm);
  end;

  begin
    update public.escola_perfis set papel='aluno'
    where id=v_resp_alfa and escola_id=v_alfa;
    insert into qa_results values ('ROLE_01_bloqueia_perfil_aluno', false, 'update aceito');
  exception when others then
    insert into qa_results values ('ROLE_01_bloqueia_perfil_aluno', true, sqlerrm);
  end;

  begin
    insert into public.escola_convites(escola_id,nome,email,papel,status,expira_em)
    values(v_alfa,'QA Aluno','qa.aluno@example.invalid','aluno','pendente',now()+interval '1 day');
    insert into qa_results values ('ROLE_02_bloqueia_convite_aluno', false, 'insert aceito');
  exception when others then
    insert into qa_results values ('ROLE_02_bloqueia_convite_aluno', true, sqlerrm);
  end;

  insert into qa_results values ('CNPJ_01_fake_alfa_valido', public.escola_cnpj_valido('99999999000191'), null);
  insert into qa_results values ('CNPJ_02_checksum_invalido_bloqueado', not public.escola_cnpj_valido('99999999000190'), null);
  insert into qa_results values ('CNPJ_03_repetido_bloqueado', not public.escola_cnpj_valido('11111111111111'), null);
end $$;

select test_id, passed, detail
from qa_results
order by test_id;

rollback;
