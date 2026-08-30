-- MBA Escola: invariantes internos que complementam o isolamento por escola.

create or replace function public.escola_validate_justification_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_school uuid;
  v_student uuid;
  v_status text;
begin
  select f.escola_id, f.aluno_id, f.status
    into v_school, v_student, v_status
    from public.escola_frequencias f
   where f.id = new.frequencia_id;

  if v_school is null
     or v_school <> new.escola_id
     or v_student <> new.aluno_id
     or v_status <> 'falta' then
    raise exception 'Justificativa não corresponde à falta do aluno informado.';
  end if;

  if not exists (
    select 1
    from public.escola_aluno_responsaveis ar
    where ar.escola_id = new.escola_id
      and ar.aluno_id = new.aluno_id
      and ar.responsavel_id = new.responsavel_id
  ) then
    raise exception 'Responsável não está vinculado ao aluno da justificativa.';
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_justification_integrity() from public, anon, authenticated;

drop trigger if exists trg_escola_justificativa_integrity on public.escola_justificativas_falta;
create trigger trg_escola_justificativa_integrity
before insert or update on public.escola_justificativas_falta
for each row execute function public.escola_validate_justification_integrity();

create or replace function public.escola_validate_meeting_guardian_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.aluno_id is not null and new.responsavel_id is not null then
    if not exists (
      select 1
      from public.escola_aluno_responsaveis ar
      where ar.escola_id = new.escola_id
        and ar.aluno_id = new.aluno_id
        and ar.responsavel_id = new.responsavel_id
    ) then
      raise exception 'Responsável não está vinculado ao aluno da reunião.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_meeting_guardian_link() from public, anon, authenticated;

drop trigger if exists trg_escola_reuniao_guardian_link on public.escola_reunioes;
create trigger trg_escola_reuniao_guardian_link
before insert or update on public.escola_reunioes
for each row execute function public.escola_validate_meeting_guardian_link();

create or replace function public.escola_validate_occurrence_awareness_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_school uuid;
  v_student uuid;
begin
  if tg_op='UPDATE'
     and new.ocorrencia_id is not distinct from old.ocorrencia_id
     and new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;

  select o.escola_id, o.aluno_id
    into v_school, v_student
    from public.escola_ocorrencias_aluno o
   where o.id = new.ocorrencia_id;

  if v_school is null
     or not exists (
       select 1
       from public.escola_perfis p
       where p.id = new.responsavel_id
         and p.escola_id = v_school
         and p.papel = 'responsavel'
         and p.ativo = true
     ) then
    raise exception 'Responsável inválido para a escola da ocorrência';
  end if;

  if not exists (
    select 1
    from public.escola_aluno_responsaveis ar
    where ar.escola_id = v_school
      and ar.aluno_id = v_student
      and ar.responsavel_id = new.responsavel_id
  ) then
    raise exception 'Responsável não está vinculado ao aluno da ocorrência';
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_occurrence_awareness_role() from public, anon, authenticated;

create or replace function public.escola_validate_frequency_grade_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_school uuid;
  v_class uuid;
begin
  if new.grade_id is null then
    return new;
  end if;

  select g.escola_id, g.turma_id
    into v_school, v_class
    from public.escola_grade_horarios g
   where g.id = new.grade_id;

  if v_school is null
     or v_school <> new.escola_id
     or v_class is distinct from new.turma_id then
    raise exception 'Grade e turma da frequência não correspondem.';
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_frequency_grade_scope() from public, anon, authenticated;

drop trigger if exists trg_escola_frequencia_grade_scope on public.escola_frequencias;
create trigger trg_escola_frequencia_grade_scope
before insert or update on public.escola_frequencias
for each row execute function public.escola_validate_frequency_grade_scope();

create or replace function public.escola_validate_intercorrencia_grade_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_school uuid;
  v_class uuid;
begin
  if new.grade_id is null then
    return new;
  end if;

  select g.escola_id, g.turma_id
    into v_school, v_class
    from public.escola_grade_horarios g
   where g.id = new.grade_id;

  if v_school is null
     or v_school <> new.escola_id
     or v_class is distinct from new.turma_id then
    raise exception 'Grade e turma da intercorrência não correspondem.';
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_intercorrencia_grade_scope() from public, anon, authenticated;

drop trigger if exists trg_escola_intercorrencia_grade_scope on public.escola_intercorrencias_grade;
create trigger trg_escola_intercorrencia_grade_scope
before insert or update on public.escola_intercorrencias_grade
for each row execute function public.escola_validate_intercorrencia_grade_scope();
