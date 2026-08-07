-- MBA Escola - Administração completa do dono do sistema
-- Aplicar SOMENTE no projeto Supabase do MBA Escola.

create or replace function public.escola_admin_is_super()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.escola_super_admins a
    where a.user_id = auth.uid()
  );
$$;

grant execute on function public.escola_admin_is_super() to authenticated;

create or replace function public.escola_admin_list_schools()
returns table (
  id uuid,
  nome text,
  slug text,
  status text,
  criado_em timestamptz,
  total_usuarios bigint,
  total_alunos bigint,
  total_turmas bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    e.id,
    e.nome,
    e.slug,
    e.status,
    e.criado_em,
    (select count(*) from public.escola_perfis p where p.escola_id = e.id),
    (select count(*) from public.escola_alunos a where a.escola_id = e.id),
    (select count(*) from public.escola_turmas t where t.escola_id = e.id)
  from public.escola_escolas e
  order by e.nome;
end;
$$;

grant execute on function public.escola_admin_list_schools() to authenticated;

create or replace function public.escola_admin_create_school(
  p_nome text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  if nullif(trim(p_nome), '') is null or nullif(trim(p_slug), '') is null then
    raise exception 'Nome e identificador são obrigatórios';
  end if;

  insert into public.escola_escolas (nome, slug, status)
  values (trim(p_nome), lower(trim(p_slug)), 'teste')
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.escola_admin_create_school(text, text) to authenticated;

create or replace function public.escola_admin_update_school(
  p_id uuid,
  p_nome text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  if p_status not in ('ativa', 'teste', 'bloqueada', 'cancelada') then
    raise exception 'Status inválido';
  end if;

  update public.escola_escolas
  set nome = trim(p_nome),
      status = p_status,
      atualizado_em = now()
  where id = p_id;
end;
$$;

grant execute on function public.escola_admin_update_school(uuid, text, text) to authenticated;

create or replace function public.escola_admin_delete_school(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_ids uuid[];
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  select coalesce(array_agg(p.id), array[]::uuid[])
  into v_user_ids
  from public.escola_perfis p
  where p.escola_id = p_id;

  delete from public.escola_escolas where id = p_id;

  if cardinality(v_user_ids) > 0 then
    delete from auth.users where id = any(v_user_ids);
  end if;
end;
$$;

grant execute on function public.escola_admin_delete_school(uuid) to authenticated;

create or replace function public.escola_admin_list_users()
returns table (
  user_id uuid,
  nome text,
  email text,
  papel text,
  escola_id uuid,
  escola_nome text,
  ativo boolean,
  criado_em timestamptz,
  ultimo_acesso timestamptz,
  dono_sistema boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    u.id,
    coalesce(p.nome, sa.nome, split_part(coalesce(u.email, ''), '@', 1))::text,
    coalesce(u.email, sa.email)::text,
    case when sa.user_id is not null then 'dono_sistema' else p.papel end::text,
    p.escola_id,
    e.nome::text,
    coalesce(p.ativo, true),
    u.created_at,
    u.last_sign_in_at,
    (sa.user_id is not null)
  from auth.users u
  left join public.escola_perfis p on p.id = u.id
  left join public.escola_escolas e on e.id = p.escola_id
  left join public.escola_super_admins sa on sa.user_id = u.id
  where p.id is not null or sa.user_id is not null
  order by (sa.user_id is not null) desc, coalesce(p.nome, sa.nome, u.email);
end;
$$;

grant execute on function public.escola_admin_list_users() to authenticated;

create or replace function public.escola_admin_update_user(
  p_user_id uuid,
  p_nome text,
  p_escola_id uuid,
  p_papel text,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  if exists (select 1 from public.escola_super_admins sa where sa.user_id = p_user_id) then
    raise exception 'O dono do sistema não pode ser alterado por esta ação';
  end if;

  if p_papel not in ('direcao', 'coordenacao', 'professor', 'responsavel') then
    raise exception 'Perfil inválido';
  end if;

  update public.escola_perfis
  set nome = trim(p_nome),
      escola_id = p_escola_id,
      papel = p_papel,
      ativo = p_ativo,
      atualizado_em = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.escola_admin_update_user(uuid, text, uuid, text, boolean) to authenticated;

create or replace function public.escola_admin_set_user_active(
  p_user_id uuid,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Você não pode inativar o próprio acesso';
  end if;

  if exists (select 1 from public.escola_super_admins sa where sa.user_id = p_user_id) then
    raise exception 'Este acesso administrativo não pode ser inativado';
  end if;

  update public.escola_perfis
  set ativo = p_ativo,
      atualizado_em = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.escola_admin_set_user_active(uuid, boolean) to authenticated;

create or replace function public.escola_admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$;
declare
  v_email text;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Você não pode excluir o próprio acesso';
  end if;

  if exists (select 1 from public.escola_super_admins sa where sa.user_id = p_user_id) then
    raise exception 'O dono do sistema não pode ser excluído';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  delete from public.escola_perfis where id = p_user_id;

  if v_email is not null then
    delete from public.escola_convites where lower(email::text) = lower(v_email);
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.escola_admin_delete_user(uuid) to authenticated;

create or replace function public.escola_admin_list_invites()
returns table (
  id uuid,
  escola_id uuid,
  escola_nome text,
  nome text,
  email text,
  papel text,
  status text,
  criado_em timestamptz,
  aceito_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    c.id,
    c.escola_id,
    e.nome::text,
    c.nome::text,
    c.email::text,
    c.papel::text,
    c.status::text,
    c.criado_em,
    c.aceito_em
  from public.escola_convites c
  left join public.escola_escolas e on e.id = c.escola_id
  order by c.criado_em desc;
end;
$$;

grant execute on function public.escola_admin_list_invites() to authenticated;

create or replace function public.escola_admin_create_invite(
  p_escola_id uuid,
  p_nome text,
  p_email text,
  p_papel text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$;
declare
  v_id uuid;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  if p_papel not in ('direcao', 'coordenacao', 'professor', 'responsavel') then
    raise exception 'Perfil inválido';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'E-mail obrigatório';
  end if;

  select id into v_id
  from public.escola_convites
  where lower(email::text) = lower(trim(p_email))
  order by criado_em desc
  limit 1;

  if v_id is not null then
    update public.escola_convites
    set escola_id = p_escola_id,
        nome = trim(p_nome),
        email = lower(trim(p_email)),
        papel = p_papel,
        status = 'pendente',
        aceito_em = null,
        atualizado_em = now()
    where id = v_id;
  else
    insert into public.escola_convites (escola_id, nome, email, papel, status)
    values (p_escola_id, trim(p_nome), lower(trim(p_email)), p_papel, 'pendente')
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.escola_admin_create_invite(uuid, text, text, text) to authenticated;

create or replace function public.escola_admin_cancel_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  update public.escola_convites
  set status = 'cancelado', atualizado_em = now()
  where id = p_id;
end;
$$;

grant execute on function public.escola_admin_cancel_invite(uuid) to authenticated;

create or replace function public.escola_admin_delete_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$;
begin
  if not public.escola_admin_is_super() then
    raise exception 'Acesso negado';
  end if;

  delete from public.escola_convites where id = p_id;
end;
$$;

grant execute on function public.escola_admin_delete_invite(uuid) to authenticated;
