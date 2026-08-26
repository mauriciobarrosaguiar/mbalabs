begin;
-- MBA Escola: cada conta pode participar de várias escolas sem duplicar login.
-- O UUID em escola_perfis.id continua sendo o auth.users.id; a identidade do vínculo
-- passa a ser composta por (id, escola_id).

alter table public.escola_aluno_responsaveis drop constraint if exists escola_aluno_responsaveis_responsavel_id_fkey;
alter table public.escola_atividades drop constraint if exists escola_atividades_professor_id_fkey;
alter table public.escola_autorizacao_resposta_historico drop constraint if exists escola_autorizacao_resposta_historico_responsavel_id_fkey;
alter table public.escola_autorizacao_respostas drop constraint if exists escola_autorizacao_respostas_responsavel_id_fkey;
alter table public.escola_grade_horarios drop constraint if exists escola_grade_horarios_professor_id_fkey;
alter table public.escola_intercorrencias_grade drop constraint if exists escola_intercorrencias_grade_substituto_id_fkey;
alter table public.escola_justificativa_arquivos drop constraint if exists escola_justificativa_arquivos_responsavel_id_fkey;
alter table public.escola_justificativas_falta drop constraint if exists escola_justificativas_falta_responsavel_id_fkey;
alter table public.escola_ocorrencia_ciencias drop constraint if exists escola_ocorrencia_ciencias_responsavel_id_fkey;
alter table public.escola_professor_alocacoes drop constraint if exists escola_professor_alocacoes_professor_id_fkey;
alter table public.escola_reunioes drop constraint if exists escola_reunioes_responsavel_id_fkey;
alter table public.escola_turmas drop constraint if exists escola_turmas_professor_responsavel_id_fkey;

alter table public.escola_perfis drop constraint if exists escola_perfis_pkey;
alter table public.escola_perfis add constraint escola_perfis_pkey primary key (id, escola_id);

alter table public.escola_aluno_responsaveis add constraint escola_aluno_responsaveis_responsavel_id_fkey foreign key (responsavel_id) references auth.users(id) on delete cascade;
alter table public.escola_atividades add constraint escola_atividades_professor_id_fkey foreign key (professor_id) references auth.users(id) on delete cascade;
alter table public.escola_autorizacao_resposta_historico add constraint escola_autorizacao_resposta_historico_responsavel_id_fkey foreign key (responsavel_id) references auth.users(id) on delete cascade;
alter table public.escola_autorizacao_respostas add constraint escola_autorizacao_respostas_responsavel_id_fkey foreign key (responsavel_id) references auth.users(id) on delete cascade;
alter table public.escola_grade_horarios add constraint escola_grade_horarios_professor_id_fkey foreign key (professor_id) references auth.users(id) on delete cascade;
alter table public.escola_intercorrencias_grade add constraint escola_intercorrencias_grade_substituto_id_fkey foreign key (substituto_id) references auth.users(id) on delete set null;
alter table public.escola_justificativa_arquivos add constraint escola_justificativa_arquivos_responsavel_id_fkey foreign key (responsavel_id) references auth.users(id) on delete cascade;
alter table public.escola_justificativas_falta add constraint escola_justificativas_falta_responsavel_id_fkey foreign key (responsavel_id) references auth.users(id) on delete cascade;
alter table public.escola_ocorrencia_ciencias add constraint escola_ocorrencia_ciencias_responsavel_id_fkey foreign key (responsavel_id) references auth.users(id) on delete cascade;
alter table public.escola_professor_alocacoes add constraint escola_professor_alocacoes_professor_id_fkey foreign key (professor_id) references auth.users(id) on delete cascade;
alter table public.escola_reunioes add constraint escola_reunioes_responsavel_id_fkey foreign key (responsavel_id) references auth.users(id) on delete set null;
alter table public.escola_turmas add constraint escola_turmas_professor_responsavel_id_fkey foreign key (professor_responsavel_id) references auth.users(id) on delete set null;

create index if not exists escola_perfis_usuario_ativo_idx on public.escola_perfis(id, ativo);
create index if not exists escola_perfis_escola_papel_ativo_idx on public.escola_perfis(escola_id, papel, ativo);

create table if not exists public.escola_usuario_contextos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  escola_id uuid not null references public.escola_escolas(id) on delete cascade,
  atualizado_em timestamptz not null default now()
);

alter table public.escola_usuario_contextos enable row level security;
revoke all on public.escola_usuario_contextos from anon;
revoke insert, update, delete, truncate, trigger, references on public.escola_usuario_contextos from authenticated;
grant select on public.escola_usuario_contextos to authenticated;

drop policy if exists escola_usuario_contexto_self_select on public.escola_usuario_contextos;
create policy escola_usuario_contexto_self_select on public.escola_usuario_contextos for select to authenticated using (user_id = auth.uid() or public.escola_is_super_admin());

create or replace function public.escola_select_school(p_escola_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if public.escola_is_super_admin() then
    if not exists (select 1 from public.escola_escolas e where e.id = p_escola_id and e.status in ('ativa','teste')) then raise exception 'Escola indisponível'; end if;
  elsif not exists (
    select 1 from public.escola_perfis p join public.escola_escolas e on e.id = p.escola_id
    where p.id = auth.uid() and p.escola_id = p_escola_id and p.ativo = true and e.status in ('ativa','teste')
  ) then raise exception 'Acesso negado a esta escola'; end if;
  insert into public.escola_usuario_contextos(user_id, escola_id, atualizado_em)
  values(auth.uid(), p_escola_id, now())
  on conflict(user_id) do update set escola_id=excluded.escola_id, atualizado_em=excluded.atualizado_em;
  return p_escola_id;
end;
$$;
revoke all on function public.escola_select_school(uuid) from public, anon;
grant execute on function public.escola_select_school(uuid) to authenticated;

create or replace function public.escola_my_memberships()
returns table(escola_id uuid, escola_nome text, escola_status text, nome text, email text, telefone text, papel text, ativo boolean, is_teste boolean, criado_em timestamptz)
language sql stable security definer set search_path = pg_catalog, public as $$
  select p.escola_id,e.nome,e.status,p.nome,p.email,p.telefone,p.papel,p.ativo,p.is_teste,p.criado_em
  from public.escola_perfis p join public.escola_escolas e on e.id=p.escola_id
  where p.id=auth.uid() order by p.ativo desc, e.nome, p.criado_em;
$$;
revoke all on function public.escola_my_memberships() from public, anon;
grant execute on function public.escola_my_memberships() to authenticated;

create or replace function public.escola_current_school_id()
returns uuid language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_school uuid; v_count integer;
begin
  if auth.uid() is null then return null; end if;
  if public.escola_is_super_admin() then
    select c.escola_id into v_school from public.escola_usuario_contextos c join public.escola_escolas e on e.id=c.escola_id
    where c.user_id=auth.uid() and e.status in ('ativa','teste');
    return v_school;
  end if;
  select c.escola_id into v_school
  from public.escola_usuario_contextos c
  join public.escola_perfis p on p.id=c.user_id and p.escola_id=c.escola_id and p.ativo=true
  join public.escola_escolas e on e.id=c.escola_id and e.status in ('ativa','teste')
  where c.user_id=auth.uid();
  if v_school is not null then return v_school; end if;
  select count(*) into v_count from public.escola_perfis p join public.escola_escolas e on e.id=p.escola_id
  where p.id=auth.uid() and p.ativo=true and e.status in ('ativa','teste');
  if v_count = 1 then
    select p.escola_id into v_school from public.escola_perfis p join public.escola_escolas e on e.id=p.escola_id
    where p.id=auth.uid() and p.ativo=true and e.status in ('ativa','teste') limit 1;
    return v_school;
  end if;
  return null;
end;
$$;

create or replace function public.escola_current_role()
returns text language sql stable security definer set search_path = pg_catalog, public as $$
  select case when public.escola_is_super_admin() then 'admin_mba'::text else (
    select p.papel from public.escola_perfis p where p.id=auth.uid() and p.escola_id=public.escola_current_school_id() and p.ativo=true limit 1
  ) end;
$$;

create or replace function public.escola_same_school(p_escola_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.escola_is_super_admin() or public.escola_current_school_id() = p_escola_id;
$$;

create or replace function public.escola_can_manage_school(p_escola_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.escola_is_super_admin() or (
    public.escola_current_school_id() = p_escola_id and exists (
      select 1 from public.escola_perfis p join public.escola_escolas e on e.id=p.escola_id
      where p.id=auth.uid() and p.escola_id=p_escola_id and p.ativo=true
        and p.papel in ('admin_escola','direcao','coordenacao') and e.status in ('ativa','teste')
    )
  );
$$;

create or replace function public.escola_can_admin_school(p_escola_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.escola_is_super_admin() or (
    public.escola_current_school_id() = p_escola_id and exists (
      select 1 from public.escola_perfis p join public.escola_escolas e on e.id=p.escola_id
      where p.id=auth.uid() and p.escola_id=p_escola_id and p.ativo=true and p.papel='admin_escola' and e.status in ('ativa','teste')
    )
  );
$$;

create or replace function public.escola_can_access_class(p_turma_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.escola_is_super_admin()
  or exists (select 1 from public.escola_turmas t where t.id=p_turma_id and public.escola_can_manage_school(t.escola_id))
  or exists (
    select 1 from public.escola_professor_alocacoes pa join public.escola_turmas t on t.id=pa.turma_id
    where pa.turma_id=p_turma_id and pa.professor_id=auth.uid() and pa.ativo=true and t.ativa=true and public.escola_same_school(t.escola_id)
  )
  or exists (
    select 1 from public.escola_aluno_responsaveis ar join public.escola_alunos a on a.id=ar.aluno_id
    where ar.responsavel_id=auth.uid() and a.turma_id=p_turma_id and a.ativo=true and public.escola_same_school(a.escola_id)
  );
$$;

create or replace function public.escola_can_access_student(p_aluno_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.escola_is_super_admin()
  or exists (select 1 from public.escola_alunos a where a.id=p_aluno_id and public.escola_can_manage_school(a.escola_id))
  or exists (
    select 1 from public.escola_alunos a join public.escola_professor_alocacoes pa on pa.turma_id=a.turma_id and pa.professor_id=auth.uid() and pa.ativo=true
    where a.id=p_aluno_id and a.ativo=true and public.escola_same_school(a.escola_id)
  )
  or exists (
    select 1 from public.escola_aluno_responsaveis ar join public.escola_alunos a on a.id=ar.aluno_id
    where ar.aluno_id=p_aluno_id and ar.responsavel_id=auth.uid() and public.escola_same_school(a.escola_id)
  );
$$;

create or replace function public.escola_can_access_student_document(p_aluno_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.escola_is_super_admin()
  or exists (select 1 from public.escola_alunos a where a.id=p_aluno_id and public.escola_can_manage_school(a.escola_id))
  or exists (
    select 1 from public.escola_aluno_responsaveis ar join public.escola_alunos a on a.id=ar.aluno_id
    where ar.aluno_id=p_aluno_id and ar.responsavel_id=auth.uid() and public.escola_same_school(a.escola_id)
  );
$$;
commit;
