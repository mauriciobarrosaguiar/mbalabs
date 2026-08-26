begin;
-- Perfil é vínculo. Identidade e escola não podem ser movidas por UPDATE.
create or replace function public.escola_lock_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.id is distinct from old.id or new.escola_id is distinct from old.escola_id then
    raise exception 'Identidade do vínculo escolar é imutável';
  end if;
  return new;
end;
$$;
revoke all on function public.escola_lock_profile_identity() from public, anon, authenticated;
drop trigger if exists trg_escola_lock_profile_identity on public.escola_perfis;
create trigger trg_escola_lock_profile_identity before update on public.escola_perfis for each row execute function public.escola_lock_profile_identity();

drop policy if exists escola_profile_admin_write on public.escola_perfis;
drop policy if exists escola_profile_admin_update on public.escola_perfis;
drop policy if exists escola_profile_admin_delete on public.escola_perfis;
create policy escola_profile_admin_update on public.escola_perfis for update to authenticated
using (public.escola_can_admin_school(escola_id))
with check (public.escola_can_admin_school(escola_id) and papel <> 'aluno');
create policy escola_profile_admin_delete on public.escola_perfis for delete to authenticated
using (public.escola_can_admin_school(escola_id) and papel <> 'aluno');

create or replace function public.escola_validate_role_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid;
  v_school uuid;
  v_column text := tg_argv[0];
  v_role text := tg_argv[1];
begin
  if tg_op='UPDATE'
     and (to_jsonb(new)->>v_column) is not distinct from (to_jsonb(old)->>v_column)
     and (to_jsonb(new)->>'escola_id') is not distinct from (to_jsonb(old)->>'escola_id') then
    return new;
  end if;
  v_user := public.escola_try_uuid(to_jsonb(new)->>v_column);
  if v_user is null then return new; end if;
  v_school := public.escola_try_uuid(to_jsonb(new)->>'escola_id');
  if v_school is null then raise exception 'Escola inválida no vínculo de perfil'; end if;
  if not exists (
    select 1 from public.escola_perfis p
    where p.id=v_user and p.escola_id=v_school and p.ativo=true and p.papel=v_role
  ) then
    raise exception 'Perfil % não pertence à escola com o papel %', v_column, v_role;
  end if;
  return new;
end;
$$;
revoke all on function public.escola_validate_role_reference() from public, anon, authenticated;

drop trigger if exists trg_escola_vinculo_responsavel_role on public.escola_aluno_responsaveis;
create trigger trg_escola_vinculo_responsavel_role before insert or update on public.escola_aluno_responsaveis for each row execute function public.escola_validate_role_reference('responsavel_id','responsavel');
drop trigger if exists trg_escola_atividade_professor_role on public.escola_atividades;
create trigger trg_escola_atividade_professor_role before insert or update on public.escola_atividades for each row execute function public.escola_validate_role_reference('professor_id','professor');
drop trigger if exists trg_escola_autresp_responsavel_role on public.escola_autorizacao_respostas;
create trigger trg_escola_autresp_responsavel_role before insert or update on public.escola_autorizacao_respostas for each row execute function public.escola_validate_role_reference('responsavel_id','responsavel');
drop trigger if exists trg_escola_authist_responsavel_role on public.escola_autorizacao_resposta_historico;
create trigger trg_escola_authist_responsavel_role before insert or update on public.escola_autorizacao_resposta_historico for each row execute function public.escola_validate_role_reference('responsavel_id','responsavel');
drop trigger if exists trg_escola_grade_professor_role on public.escola_grade_horarios;
create trigger trg_escola_grade_professor_role before insert or update on public.escola_grade_horarios for each row execute function public.escola_validate_role_reference('professor_id','professor');
drop trigger if exists trg_escola_intercorrencia_substituto_role on public.escola_intercorrencias_grade;
create trigger trg_escola_intercorrencia_substituto_role before insert or update on public.escola_intercorrencias_grade for each row execute function public.escola_validate_role_reference('substituto_id','professor');
drop trigger if exists trg_escola_justarquivo_responsavel_role on public.escola_justificativa_arquivos;
create trigger trg_escola_justarquivo_responsavel_role before insert or update on public.escola_justificativa_arquivos for each row execute function public.escola_validate_role_reference('responsavel_id','responsavel');
drop trigger if exists trg_escola_justificativa_responsavel_role on public.escola_justificativas_falta;
create trigger trg_escola_justificativa_responsavel_role before insert or update on public.escola_justificativas_falta for each row execute function public.escola_validate_role_reference('responsavel_id','responsavel');
drop trigger if exists trg_escola_alocacao_professor_role on public.escola_professor_alocacoes;
create trigger trg_escola_alocacao_professor_role before insert or update on public.escola_professor_alocacoes for each row execute function public.escola_validate_role_reference('professor_id','professor');
drop trigger if exists trg_escola_reuniao_responsavel_role on public.escola_reunioes;
create trigger trg_escola_reuniao_responsavel_role before insert or update on public.escola_reunioes for each row execute function public.escola_validate_role_reference('responsavel_id','responsavel');
drop trigger if exists trg_escola_turma_professor_role on public.escola_turmas;
create trigger trg_escola_turma_professor_role before insert or update on public.escola_turmas for each row execute function public.escola_validate_role_reference('professor_responsavel_id','professor');

create or replace function public.escola_validate_occurrence_awareness_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_school uuid;
begin
  if tg_op='UPDATE' and new.ocorrencia_id is not distinct from old.ocorrencia_id and new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  select o.escola_id into v_school from public.escola_ocorrencias_aluno o where o.id=new.ocorrencia_id;
  if v_school is null or not exists (
    select 1 from public.escola_perfis p
    where p.id=new.responsavel_id and p.escola_id=v_school and p.papel='responsavel' and p.ativo=true
  ) then raise exception 'Responsável inválido para a escola da ocorrência'; end if;
  return new;
end;
$$;
revoke all on function public.escola_validate_occurrence_awareness_role() from public, anon, authenticated;
drop trigger if exists trg_escola_ciencia_responsavel_role on public.escola_ocorrencia_ciencias;
create trigger trg_escola_ciencia_responsavel_role before insert or update on public.escola_ocorrencia_ciencias for each row execute function public.escola_validate_occurrence_awareness_role();
commit;
