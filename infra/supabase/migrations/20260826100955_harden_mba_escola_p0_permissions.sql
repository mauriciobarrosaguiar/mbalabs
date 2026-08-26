begin;

-- Core MBA Labs: impede que admin_empresa se promova a super_admin/admin_master.
drop policy if exists core_usuarios_manage on public.core_usuarios;
drop policy if exists core_usuarios_insert_manage on public.core_usuarios;
drop policy if exists core_usuarios_update_manage on public.core_usuarios;
drop policy if exists core_usuarios_delete_manage on public.core_usuarios;

create policy core_usuarios_insert_manage
on public.core_usuarios
for insert
to authenticated
with check (
  public.is_admin_master()
  or (
    empresa_id = public.current_empresa_id()
    and public.current_usuario_tipo() = 'admin_empresa'
    and coalesce(tipo_global, tipo, '') not in ('super_admin','admin_master')
  )
);

create policy core_usuarios_update_manage
on public.core_usuarios
for update
to authenticated
using (
  public.is_admin_master()
  or (
    empresa_id = public.current_empresa_id()
    and public.current_usuario_tipo() = 'admin_empresa'
    and coalesce(tipo_global, tipo, '') not in ('super_admin','admin_master')
  )
)
with check (
  public.is_admin_master()
  or (
    empresa_id = public.current_empresa_id()
    and public.current_usuario_tipo() = 'admin_empresa'
    and coalesce(tipo_global, tipo, '') not in ('super_admin','admin_master')
  )
);

create policy core_usuarios_delete_manage
on public.core_usuarios
for delete
to authenticated
using (
  public.is_admin_master()
  or (
    empresa_id = public.current_empresa_id()
    and public.current_usuario_tipo() = 'admin_empresa'
    and coalesce(tipo_global, tipo, '') not in ('super_admin','admin_master')
  )
);

-- MBA Escola: administração de identidade separada da gestão acadêmica.
create or replace function public.escola_can_admin_school(p_escola_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.escola_is_super_admin()
  or exists (
    select 1
    from public.escola_perfis p
    join public.escola_escolas e on e.id = p.escola_id
    where p.id = auth.uid()
      and p.ativo = true
      and p.escola_id = p_escola_id
      and p.papel = 'admin_escola'
      and e.status in ('ativa','teste')
  );
$$;

revoke all on function public.escola_can_admin_school(uuid) from public;
grant execute on function public.escola_can_admin_school(uuid) to authenticated, service_role;

drop policy if exists escola_profile_manager_write on public.escola_perfis;
drop policy if exists escola_profile_admin_write on public.escola_perfis;
create policy escola_profile_admin_write
on public.escola_perfis
for all
to authenticated
using (public.escola_can_admin_school(escola_id))
with check (public.escola_can_admin_school(escola_id) and papel <> 'aluno');

drop policy if exists escola_convite_manager_all on public.escola_convites;
drop policy if exists escola_convite_admin_all on public.escola_convites;
create policy escola_convite_admin_all
on public.escola_convites
for all
to authenticated
using (public.escola_can_admin_school(escola_id))
with check (public.escola_can_admin_school(escola_id) and papel <> 'aluno');

create or replace function public.escola_school_create_invite(
  p_nome text,
  p_email text,
  p_papel text,
  p_aluno_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escola uuid := public.escola_current_school_id();
  v_id uuid;
begin
  if not public.escola_can_admin_school(v_escola) then
    raise exception 'Acesso negado';
  end if;
  if p_papel not in ('admin_escola','direcao','coordenacao','professor','responsavel') then
    raise exception 'Perfil inválido';
  end if;
  if trim(coalesce(p_nome,'')) = '' or trim(coalesce(p_email,'')) = '' then
    raise exception 'Nome e e-mail são obrigatórios';
  end if;
  if p_aluno_id is not null and not exists (
    select 1 from public.escola_alunos where id = p_aluno_id and escola_id = v_escola
  ) then
    raise exception 'Aluno inválido';
  end if;

  update public.escola_convites
     set nome = trim(p_nome),
         papel = p_papel,
         aluno_id = p_aluno_id,
         status = 'pendente',
         expira_em = now() + interval '14 days',
         atualizado_em = now()
   where id = (
     select id
     from public.escola_convites
     where escola_id = v_escola
       and lower(email) = lower(trim(p_email))
       and status = 'pendente'
     order by criado_em desc
     limit 1
   )
  returning id into v_id;

  if v_id is null then
    insert into public.escola_convites(escola_id,nome,email,papel,aluno_id,status,expira_em)
    values(v_escola,trim(p_nome),lower(trim(p_email)),p_papel,p_aluno_id,'pendente',now()+interval '14 days')
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.escola_school_revoke_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if not public.escola_can_admin_school(v_escola) then raise exception 'Acesso negado'; end if;
  update public.escola_convites
     set status='revogado', atualizado_em=now()
   where id=p_id and escola_id=v_escola and status='pendente';
end;
$$;

create or replace function public.escola_school_set_profile_active(p_id uuid, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if not public.escola_can_admin_school(v_escola) then raise exception 'Acesso negado'; end if;
  update public.escola_perfis
     set ativo=p_ativo, atualizado_em=now()
   where id=p_id and escola_id=v_escola and papel <> 'aluno';
end;
$$;

create or replace function public.escola_school_link_guardian(
  p_aluno_id uuid,
  p_responsavel_id uuid,
  p_parentesco text,
  p_principal boolean,
  p_autorizado_buscar boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if not public.escola_can_admin_school(v_escola) then raise exception 'Acesso negado'; end if;
  if not exists(select 1 from public.escola_alunos where id=p_aluno_id and escola_id=v_escola)
     or not exists(select 1 from public.escola_perfis where id=p_responsavel_id and escola_id=v_escola and papel='responsavel' and ativo)
  then raise exception 'Vínculo inválido'; end if;
  if coalesce(p_principal,false) then
    update public.escola_aluno_responsaveis set principal=false where aluno_id=p_aluno_id and escola_id=v_escola;
  end if;
  insert into public.escola_aluno_responsaveis(escola_id,aluno_id,responsavel_id,parentesco,principal,autorizado_buscar)
  values(v_escola,p_aluno_id,p_responsavel_id,p_parentesco,coalesce(p_principal,false),coalesce(p_autorizado_buscar,true))
  on conflict(aluno_id,responsavel_id) do update
  set parentesco=excluded.parentesco, principal=excluded.principal, autorizado_buscar=excluded.autorizado_buscar;
end;
$$;

create or replace function public.escola_school_unlink_guardian(p_aluno_id uuid, p_responsavel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_escola uuid := public.escola_current_school_id();
begin
  if not public.escola_can_admin_school(v_escola) then raise exception 'Acesso negado'; end if;
  delete from public.escola_aluno_responsaveis
   where escola_id=v_escola and aluno_id=p_aluno_id and responsavel_id=p_responsavel_id;
end;
$$;

create or replace function public.escola_school_bulk_import(p_tipo text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escola uuid := public.escola_current_school_id();
  v_row jsonb;
  v_count integer:=0;
  v_turma uuid;
  v_aluno uuid;
  v_role text;
begin
  if p_tipo not in ('alunos','equipe','responsaveis') or jsonb_typeof(p_rows)<>'array' then
    raise exception 'Importação inválida';
  end if;

  if p_tipo = 'alunos' then
    if not public.escola_can_manage_school(v_escola) or public.escola_current_role()='coordenacao' then
      raise exception 'Acesso negado';
    end if;
  else
    if not public.escola_can_admin_school(v_escola) then raise exception 'Acesso negado'; end if;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    if trim(coalesce(v_row->>'nome',''))='' then raise exception 'Nome obrigatório'; end if;
    if p_tipo='alunos' then
      v_turma:=null;
      if nullif(trim(coalesce(v_row->>'turma','')),'') is not null then
        select id into v_turma from public.escola_turmas
         where escola_id=v_escola and ativa and lower(trim(nome))=lower(trim(v_row->>'turma')) limit 1;
        if v_turma is null then raise exception 'Turma não encontrada: %',v_row->>'turma'; end if;
      end if;
      perform public.escola_school_upsert_student(null,v_row->>'nome',nullif(v_row->>'data_nascimento','')::date,v_turma,true);
    elsif p_tipo='equipe' then
      v_role:=v_row->>'perfil';
      if v_role not in ('professor','coordenacao') then raise exception 'Perfil inválido: %',v_role; end if;
      perform public.escola_school_create_invite(v_row->>'nome',v_row->>'email',v_role,null);
    else
      v_aluno:=null;
      if nullif(trim(coalesce(v_row->>'aluno','')),'') is not null then
        select id into v_aluno from public.escola_alunos
         where escola_id=v_escola and ativo and lower(trim(nome))=lower(trim(v_row->>'aluno')) limit 1;
        if v_aluno is null then raise exception 'Aluno não encontrado: %',v_row->>'aluno'; end if;
      end if;
      perform public.escola_school_create_invite(v_row->>'nome',v_row->>'email','responsavel',v_aluno);
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

-- Corrige vazamentos de responsáveis: toda leitura deve vincular o aluno da linha ao responsável logado.
drop policy if exists escola_acompanhamento_select on public.escola_acompanhamentos;
create policy escola_acompanhamento_select
on public.escola_acompanhamentos
for select
to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or (
    visivel_responsavel
    and exists (
      select 1 from public.escola_aluno_responsaveis ar
      where ar.aluno_id = escola_acompanhamentos.aluno_id
        and ar.responsavel_id = auth.uid()
        and ar.escola_id = escola_acompanhamentos.escola_id
    )
  )
);

drop policy if exists escola_autdest_select on public.escola_autorizacao_destinatarios;
create policy escola_autdest_select
on public.escola_autorizacao_destinatarios
for select
to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id = escola_autorizacao_destinatarios.aluno_id
      and ar.responsavel_id = auth.uid()
      and ar.escola_id = escola_autorizacao_destinatarios.escola_id
  )
);

drop policy if exists escola_autorizacao_select on public.escola_autorizacoes;
create policy escola_autorizacao_select
on public.escola_autorizacoes
for select
to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or (
    public.escola_current_role() = 'responsavel'
    and exists (
      select 1
      from public.escola_autorizacao_destinatarios d
      join public.escola_aluno_responsaveis ar
        on ar.aluno_id = d.aluno_id
       and ar.responsavel_id = auth.uid()
      where d.autorizacao_id = escola_autorizacoes.id
        and d.escola_id = escola_autorizacoes.escola_id
        and ar.escola_id = escola_autorizacoes.escola_id
    )
  )
);

drop policy if exists escola_frequencia_select on public.escola_frequencias;
create policy escola_frequencia_select
on public.escola_frequencias
for select
to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or exists (
    select 1 from public.escola_aluno_responsaveis ar
    where ar.aluno_id = escola_frequencias.aluno_id
      and ar.responsavel_id = auth.uid()
      and ar.escola_id = escola_frequencias.escola_id
  )
);

drop policy if exists escola_ocorrencia_select on public.escola_ocorrencias_aluno;
create policy escola_ocorrencia_select
on public.escola_ocorrencias_aluno
for select
to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or (public.escola_current_role() = 'professor' and public.escola_can_access_student(aluno_id))
  or (
    visivel_responsavel
    and exists (
      select 1 from public.escola_aluno_responsaveis ar
      where ar.aluno_id = escola_ocorrencias_aluno.aluno_id
        and ar.responsavel_id = auth.uid()
        and ar.escola_id = escola_ocorrencias_aluno.escola_id
    )
  )
);

drop policy if exists escola_reuniao_select on public.escola_reunioes;
create policy escola_reuniao_select
on public.escola_reunioes
for select
to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or (
    public.escola_current_role() = 'professor'
    and public.escola_same_school(escola_id)
    and (aluno_id is null or public.escola_can_access_student(aluno_id))
  )
  or responsavel_id = auth.uid()
  or (
    aluno_id is not null
    and exists (
      select 1 from public.escola_aluno_responsaveis ar
      where ar.aluno_id = escola_reunioes.aluno_id
        and ar.responsavel_id = auth.uid()
        and ar.escola_id = escola_reunioes.escola_id
    )
  )
);

drop policy if exists escola_agenda_select on public.escola_agenda_eventos;
create policy escola_agenda_select
on public.escola_agenda_eventos
for select
to authenticated
using (
  public.escola_can_manage_school(escola_id)
  or (
    public.escola_current_role() = 'professor'
    and public.escola_same_school(escola_id)
    and (turma_id is null or public.escola_can_access_class(turma_id))
    and (aluno_id is null or public.escola_can_access_student(aluno_id))
  )
  or (
    visivel_responsavel
    and (
      (aluno_id is not null and public.escola_can_access_student_document(aluno_id))
      or (
        aluno_id is null
        and (
          (turma_id is null and public.escola_same_school(escola_id))
          or (turma_id is not null and public.escola_can_access_class(turma_id))
        )
      )
    )
  )
);

commit;
