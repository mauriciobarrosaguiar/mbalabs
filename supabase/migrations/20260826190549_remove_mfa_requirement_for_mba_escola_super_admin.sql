-- ADMIN MBA: volta a usar autenticação padrão por e-mail e senha.
-- A recuperação de senha ocorre por link seguro enviado por e-mail; MFA deixa de ser requisito.

create or replace function public.escola_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.escola_super_admins s
    where s.user_id = auth.uid()
      and s.ativo = true
  );
$$;

revoke all on function public.escola_is_super_admin() from public;
revoke execute on function public.escola_is_super_admin() from anon;
grant execute on function public.escola_is_super_admin() to authenticated, service_role;

drop policy if exists escola_super_admin_self_select on public.escola_super_admins;
