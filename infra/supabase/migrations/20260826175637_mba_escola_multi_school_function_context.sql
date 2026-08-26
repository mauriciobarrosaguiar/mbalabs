begin;
-- Fluxos sensíveis de responsável também respeitam o contexto escolar.
create or replace function public.escola_guardian_submit_absence_justification(p_frequencia_id uuid, p_motivo text, p_descricao text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_abs public.escola_frequencias%rowtype; v_id uuid;
begin
  select * into v_abs from public.escola_frequencias where id=p_frequencia_id and status='falta';
  if v_abs.id is null or not public.escola_same_school(v_abs.escola_id)
     or not exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=v_abs.aluno_id and ar.escola_id=v_abs.escola_id and ar.responsavel_id=auth.uid())
  then raise exception 'Acesso negado'; end if;
  insert into public.escola_justificativas_falta(escola_id,frequencia_id,aluno_id,responsavel_id,motivo,descricao,status)
  values(v_abs.escola_id,v_abs.id,v_abs.aluno_id,auth.uid(),trim(p_motivo),p_descricao,'pendente')
  on conflict(frequencia_id,responsavel_id) do update set motivo=excluded.motivo,descricao=excluded.descricao,status='pendente',observacao_analise=null,analisado_por=null,analisado_em=null,atualizado_em=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.escola_ack_student_occurrence(p_ocorrencia_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_aluno uuid; v_escola uuid; v_visible boolean;
begin
  select aluno_id,escola_id,visivel_responsavel into v_aluno,v_escola,v_visible
  from public.escola_ocorrencias_aluno where id=p_ocorrencia_id and status='aberta';
  if not coalesce(v_visible,false) or not public.escola_same_school(v_escola)
     or not exists(select 1 from public.escola_aluno_responsaveis where aluno_id=v_aluno and escola_id=v_escola and responsavel_id=auth.uid())
  then raise exception 'Acesso negado'; end if;
  insert into public.escola_ocorrencia_ciencias(ocorrencia_id,responsavel_id,ciente_em)
  values(p_ocorrencia_id,auth.uid(),now())
  on conflict(ocorrencia_id,responsavel_id) do update set ciente_em=excluded.ciente_em;
end;
$$;

create or replace function public.escola_respond_authorization(p_autorizacao_id uuid, p_aluno_id uuid, p_decisao text, p_observacao text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_escola uuid; v_id uuid;
begin
  if p_decisao not in ('autorizada','recusada') then raise exception 'Decisão inválida'; end if;
  select a.escola_id into v_escola
  from public.escola_autorizacoes a
  join public.escola_autorizacao_destinatarios d on d.autorizacao_id=a.id and d.aluno_id=p_aluno_id
  where a.id=p_autorizacao_id and a.status='publicada' and (a.prazo_resposta is null or a.prazo_resposta>=now());
  if v_escola is null or not public.escola_same_school(v_escola)
     or not exists(select 1 from public.escola_aluno_responsaveis ar where ar.aluno_id=p_aluno_id and ar.escola_id=v_escola and ar.responsavel_id=auth.uid())
  then raise exception 'Acesso negado'; end if;
  insert into public.escola_autorizacao_respostas(escola_id,autorizacao_id,aluno_id,responsavel_id,decisao,observacao)
  values(v_escola,p_autorizacao_id,p_aluno_id,auth.uid(),p_decisao,p_observacao)
  on conflict(autorizacao_id,aluno_id) do update set responsavel_id=auth.uid(),decisao=excluded.decisao,observacao=excluded.observacao,atualizado_em=now()
  returning id into v_id;
  insert into public.escola_autorizacao_resposta_historico(escola_id,autorizacao_id,aluno_id,responsavel_id,decisao,observacao)
  values(v_escola,p_autorizacao_id,p_aluno_id,auth.uid(),p_decisao,p_observacao);
  return v_id;
end;
$$;

create or replace function public.escola_document_upload_allowed(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with p as (
    select public.escola_try_uuid(split_part(p_path,'/',1)) escola_id,
           public.escola_try_uuid(split_part(p_path,'/',2)) aluno_id,
           public.escola_try_uuid(split_part(p_path,'/',3)) justificativa_id,
           nullif(split_part(p_path,'/',4),'') arquivo
  )
  select exists (
    select 1 from p
    join public.escola_justificativas_falta j on j.id=p.justificativa_id
    join public.escola_alunos a on a.id=p.aluno_id and a.escola_id=p.escola_id
    join public.escola_aluno_responsaveis ar on ar.escola_id=p.escola_id and ar.aluno_id=p.aluno_id and ar.responsavel_id=auth.uid()
    where p.arquivo is not null and public.escola_same_school(p.escola_id)
      and j.escola_id=p.escola_id and j.aluno_id=p.aluno_id and j.responsavel_id=auth.uid()
      and j.status in ('pendente','correcao_solicitada','recusada')
  );
$$;

create or replace function public.escola_document_read_allowed(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.escola_is_super_admin()
  or exists (
    select 1 from public.escola_justificativa_arquivos f
    where f.storage_path=p_path and f.excluido_em is null
      and (
        public.escola_can_manage_school(f.escola_id)
        or (public.escola_same_school(f.escola_id) and f.responsavel_id=auth.uid() and exists (
          select 1 from public.escola_aluno_responsaveis ar
          where ar.escola_id=f.escola_id and ar.aluno_id=f.aluno_id and ar.responsavel_id=auth.uid()
        ))
      )
  );
$$;

create or replace function public.escola_school_list_classes()
returns table(id uuid,nome text,ano_letivo integer,turno text,ativa boolean,professor_responsavel_id uuid,professor_nome text,total_alunos bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_escola uuid:=public.escola_current_school_id();
begin
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  return query select t.id,t.nome,t.ano_letivo,t.turno,t.ativa,t.professor_responsavel_id,p.nome,
    (select count(*) from public.escola_alunos a where a.turma_id=t.id and a.ativo)
  from public.escola_turmas t
  left join public.escola_perfis p on p.id=t.professor_responsavel_id and p.escola_id=t.escola_id
  where t.escola_id=v_escola order by t.nome;
end;
$$;

create or replace function public.escola_school_student_guardians(p_aluno_id uuid)
returns table(responsavel_id uuid,nome text,email text,parentesco text,principal boolean,autorizado_buscar boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_escola uuid:=public.escola_current_school_id();
begin
  if not public.escola_can_manage_school(v_escola) or not exists(select 1 from public.escola_alunos where id=p_aluno_id and escola_id=v_escola) then raise exception 'Acesso negado'; end if;
  return query select p.id,p.nome,p.email,ar.parentesco,ar.principal,ar.autorizado_buscar
  from public.escola_aluno_responsaveis ar
  join public.escola_perfis p on p.id=ar.responsavel_id and p.escola_id=ar.escola_id
  where ar.aluno_id=p_aluno_id and ar.escola_id=v_escola
  order by ar.principal desc,p.nome;
end;
$$;

create or replace function public.escola_student_pickup_options(p_aluno_id uuid)
returns table(tipo_pessoa text,pessoa_id uuid,nome text,parentesco text,telefone text,documento text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_escola uuid;
begin
  select escola_id into v_escola from public.escola_alunos where id=p_aluno_id;
  if v_escola is null or not public.escola_can_access_student_document(p_aluno_id) then raise exception 'Acesso negado'; end if;
  return query
  select 'responsavel'::text,p.id,p.nome,ar.parentesco,p.telefone,null::text
  from public.escola_aluno_responsaveis ar
  join public.escola_perfis p on p.id=ar.responsavel_id and p.escola_id=ar.escola_id
  where ar.aluno_id=p_aluno_id and ar.escola_id=v_escola and ar.autorizado_buscar and p.ativo
  union all
  select 'pessoa_autorizada'::text,pa.id,pa.nome,pa.parentesco,pa.telefone,pa.documento
  from public.escola_pessoas_autorizadas pa where pa.aluno_id=p_aluno_id and pa.escola_id=v_escola and pa.ativo;
end;
$$;

create or replace function public.escola_register_student_pickup(p_aluno_id uuid,p_tipo_saida text,p_tipo_pessoa text,p_pessoa_id uuid,p_motivo text default null,p_observacao text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_escola uuid; v_nome text; v_parentesco text; v_id uuid;
begin
  select escola_id into v_escola from public.escola_alunos where id=p_aluno_id and ativo;
  if v_escola is null or not public.escola_can_manage_school(v_escola) then raise exception 'Acesso negado'; end if;
  if p_tipo_pessoa='responsavel' then
    select p.nome,ar.parentesco into v_nome,v_parentesco
    from public.escola_aluno_responsaveis ar
    join public.escola_perfis p on p.id=ar.responsavel_id and p.escola_id=ar.escola_id
    where ar.escola_id=v_escola and ar.aluno_id=p_aluno_id and ar.responsavel_id=p_pessoa_id and ar.autorizado_buscar and p.ativo;
  elsif p_tipo_pessoa='pessoa_autorizada' then
    select nome,parentesco into v_nome,v_parentesco from public.escola_pessoas_autorizadas where escola_id=v_escola and id=p_pessoa_id and aluno_id=p_aluno_id and ativo;
  else raise exception 'Tipo de pessoa inválido'; end if;
  if v_nome is null then raise exception 'Pessoa não autorizada para retirar este aluno'; end if;
  insert into public.escola_retiradas_aluno(escola_id,aluno_id,tipo_saida,tipo_pessoa,pessoa_id,nome_pessoa,parentesco,motivo,observacao,registrado_por)
  values(v_escola,p_aluno_id,p_tipo_saida,p_tipo_pessoa,p_pessoa_id,v_nome,v_parentesco,p_motivo,p_observacao,auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.escola_current_school_id() from public, anon;
revoke all on function public.escola_current_role() from public, anon;
revoke all on function public.escola_same_school(uuid) from public, anon;
revoke all on function public.escola_can_manage_school(uuid) from public, anon;
revoke all on function public.escola_can_admin_school(uuid) from public, anon;
revoke all on function public.escola_can_access_class(uuid) from public, anon;
revoke all on function public.escola_can_access_student(uuid) from public, anon;
revoke all on function public.escola_can_access_student_document(uuid) from public, anon;
revoke all on function public.escola_document_upload_allowed(text) from public, anon;
revoke all on function public.escola_document_read_allowed(text) from public, anon;
grant execute on function public.escola_current_school_id() to authenticated;
grant execute on function public.escola_current_role() to authenticated;
grant execute on function public.escola_same_school(uuid) to authenticated;
grant execute on function public.escola_can_manage_school(uuid) to authenticated;
grant execute on function public.escola_can_admin_school(uuid) to authenticated;
grant execute on function public.escola_can_access_class(uuid) to authenticated;
grant execute on function public.escola_can_access_student(uuid) to authenticated;
grant execute on function public.escola_can_access_student_document(uuid) to authenticated;
grant execute on function public.escola_document_upload_allowed(text) to authenticated;
grant execute on function public.escola_document_read_allowed(text) to authenticated;
commit;
