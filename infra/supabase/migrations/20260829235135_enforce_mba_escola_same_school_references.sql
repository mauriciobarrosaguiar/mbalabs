-- MBA Escola: impede referências cruzadas entre tenants em tabelas que carregam escola_id.

create or replace function public.escola_validate_same_school_references()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_school uuid := public.escola_try_uuid(v_payload->>'escola_id');
  v_column text;
  v_table text;
  v_ref uuid;
  v_ok boolean;
  i integer := 0;
begin
  if v_school is null then
    raise exception 'Escola inválida na referência.';
  end if;

  if mod(tg_nargs, 2) <> 0 then
    raise exception 'Configuração inválida do validador de tenant.';
  end if;

  while i < tg_nargs loop
    v_column := tg_argv[i];
    v_table := tg_argv[i + 1];
    v_ref := public.escola_try_uuid(v_payload->>v_column);

    if v_ref is not null then
      execute format(
        'select exists(select 1 from public.%I r where r.id = $1 and r.escola_id = $2)',
        v_table
      )
      into v_ok
      using v_ref, v_school;

      if not coalesce(v_ok, false) then
        raise exception 'Referência % não pertence à escola informada.', v_column;
      end if;
    end if;

    i := i + 2;
  end loop;

  return new;
end;
$$;

revoke all on function public.escola_validate_same_school_references() from public, anon, authenticated;

drop trigger if exists trg_escola_alunos_same_school on public.escola_alunos;
create trigger trg_escola_alunos_same_school
before insert or update on public.escola_alunos
for each row execute function public.escola_validate_same_school_references(
  'turma_id','escola_turmas'
);

drop trigger if exists trg_escola_acompanhamentos_same_school on public.escola_acompanhamentos;
create trigger trg_escola_acompanhamentos_same_school
before insert or update on public.escola_acompanhamentos
for each row execute function public.escola_validate_same_school_references(
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_agenda_same_school on public.escola_agenda_eventos;
create trigger trg_escola_agenda_same_school
before insert or update on public.escola_agenda_eventos
for each row execute function public.escola_validate_same_school_references(
  'turma_id','escola_turmas',
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_vinculo_same_school on public.escola_aluno_responsaveis;
create trigger trg_escola_vinculo_same_school
before insert or update on public.escola_aluno_responsaveis
for each row execute function public.escola_validate_same_school_references(
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_atividade_same_school on public.escola_atividades;
create trigger trg_escola_atividade_same_school
before insert or update on public.escola_atividades
for each row execute function public.escola_validate_same_school_references(
  'turma_id','escola_turmas'
);

drop trigger if exists trg_escola_autdest_same_school on public.escola_autorizacao_destinatarios;
create trigger trg_escola_autdest_same_school
before insert or update on public.escola_autorizacao_destinatarios
for each row execute function public.escola_validate_same_school_references(
  'autorizacao_id','escola_autorizacoes',
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_autresp_same_school on public.escola_autorizacao_respostas;
create trigger trg_escola_autresp_same_school
before insert or update on public.escola_autorizacao_respostas
for each row execute function public.escola_validate_same_school_references(
  'autorizacao_id','escola_autorizacoes',
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_authist_same_school on public.escola_autorizacao_resposta_historico;
create trigger trg_escola_authist_same_school
before insert or update on public.escola_autorizacao_resposta_historico
for each row execute function public.escola_validate_same_school_references(
  'autorizacao_id','escola_autorizacoes',
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_autorizacao_same_school on public.escola_autorizacoes;
create trigger trg_escola_autorizacao_same_school
before insert or update on public.escola_autorizacoes
for each row execute function public.escola_validate_same_school_references(
  'turma_id','escola_turmas'
);

drop trigger if exists trg_escola_comunicado_same_school on public.escola_comunicados;
create trigger trg_escola_comunicado_same_school
before insert or update on public.escola_comunicados
for each row execute function public.escola_validate_same_school_references(
  'turma_id','escola_turmas'
);

drop trigger if exists trg_escola_convite_same_school on public.escola_convites;
create trigger trg_escola_convite_same_school
before insert or update on public.escola_convites
for each row execute function public.escola_validate_same_school_references(
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_frequencia_same_school on public.escola_frequencias;
create trigger trg_escola_frequencia_same_school
before insert or update on public.escola_frequencias
for each row execute function public.escola_validate_same_school_references(
  'grade_id','escola_grade_horarios',
  'turma_id','escola_turmas',
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_grade_same_school on public.escola_grade_horarios;
create trigger trg_escola_grade_same_school
before insert or update on public.escola_grade_horarios
for each row execute function public.escola_validate_same_school_references(
  'turma_id','escola_turmas',
  'disciplina_id','escola_disciplinas'
);

drop trigger if exists trg_escola_intercorrencia_same_school on public.escola_intercorrencias_grade;
create trigger trg_escola_intercorrencia_same_school
before insert or update on public.escola_intercorrencias_grade
for each row execute function public.escola_validate_same_school_references(
  'grade_id','escola_grade_horarios',
  'turma_id','escola_turmas'
);

drop trigger if exists trg_escola_justificativa_same_school on public.escola_justificativas_falta;
create trigger trg_escola_justificativa_same_school
before insert or update on public.escola_justificativas_falta
for each row execute function public.escola_validate_same_school_references(
  'frequencia_id','escola_frequencias',
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_ocorrencia_same_school on public.escola_ocorrencias_aluno;
create trigger trg_escola_ocorrencia_same_school
before insert or update on public.escola_ocorrencias_aluno
for each row execute function public.escola_validate_same_school_references(
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_autorizado_same_school on public.escola_pessoas_autorizadas;
create trigger trg_escola_autorizado_same_school
before insert or update on public.escola_pessoas_autorizadas
for each row execute function public.escola_validate_same_school_references(
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_alocacao_same_school on public.escola_professor_alocacoes;
create trigger trg_escola_alocacao_same_school
before insert or update on public.escola_professor_alocacoes
for each row execute function public.escola_validate_same_school_references(
  'turma_id','escola_turmas',
  'disciplina_id','escola_disciplinas'
);

drop trigger if exists trg_escola_retirada_same_school on public.escola_retiradas_aluno;
create trigger trg_escola_retirada_same_school
before insert or update on public.escola_retiradas_aluno
for each row execute function public.escola_validate_same_school_references(
  'aluno_id','escola_alunos'
);

drop trigger if exists trg_escola_reuniao_same_school on public.escola_reunioes;
create trigger trg_escola_reuniao_same_school
before insert or update on public.escola_reunioes
for each row execute function public.escola_validate_same_school_references(
  'aluno_id','escola_alunos'
);

create or replace function public.escola_validate_activity_delivery_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_activity_school uuid;
  v_activity_class uuid;
  v_student_school uuid;
  v_student_class uuid;
begin
  select a.escola_id, a.turma_id
    into v_activity_school, v_activity_class
    from public.escola_atividades a
   where a.id = new.atividade_id;

  select a.escola_id, a.turma_id
    into v_student_school, v_student_class
    from public.escola_alunos a
   where a.id = new.aluno_id;

  if v_activity_school is null
     or v_student_school is null
     or v_activity_school <> v_student_school
     or v_activity_class is distinct from v_student_class then
    raise exception 'Aluno não pertence à turma da atividade.';
  end if;

  return new;
end;
$$;

revoke all on function public.escola_validate_activity_delivery_scope() from public, anon, authenticated;

drop trigger if exists trg_escola_entrega_scope on public.escola_atividade_entregas;
create trigger trg_escola_entrega_scope
before insert or update on public.escola_atividade_entregas
for each row execute function public.escola_validate_activity_delivery_scope();

drop policy if exists escola_leitura_self_write on public.escola_comunicado_leituras;
create policy escola_leitura_self_write on public.escola_comunicado_leituras
for all to authenticated
using (
  usuario_id = auth.uid()
  and exists (
    select 1
    from public.escola_comunicados c
    where c.id = escola_comunicado_leituras.comunicado_id
      and public.escola_same_school(c.escola_id)
      and (c.turma_id is null or public.escola_can_access_class(c.turma_id))
  )
)
with check (
  usuario_id = auth.uid()
  and exists (
    select 1
    from public.escola_comunicados c
    where c.id = escola_comunicado_leituras.comunicado_id
      and public.escola_same_school(c.escola_id)
      and (c.turma_id is null or public.escola_can_access_class(c.turma_id))
  )
);
