-- Auditoria de acesso: perfis legados devem respeitar status ativo.
-- Evita que um perfil inativado continue recebendo privilégios via helpers RLS antigos.

update public.users_profile
set
  role = 'CONFERENTE',
  status = 'inativo',
  updated_at = now()
where lower(email) = 'djhanlj@gmail.com'
  and (role = 'SUPER_ADMIN' or status <> 'inativo');

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users_profile
  where auth_user_id = auth.uid()
    and status = 'ativo'
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users_profile
  where auth_user_id = auth.uid()
    and status = 'ativo'
  limit 1;
$$;
