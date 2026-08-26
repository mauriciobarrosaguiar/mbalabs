-- ADMIN MBA: super-admin privileges only exist after a verified MFA factor (AAL2).
-- Regular school roles continue to use their existing school-scoped permissions.

create or replace function public.escola_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from public.escola_super_admins s
      where s.user_id = auth.uid()
        and s.ativo = true
    );
$$;

revoke all on function public.escola_is_super_admin() from public;
revoke execute on function public.escola_is_super_admin() from anon;
grant execute on function public.escola_is_super_admin() to authenticated, service_role;

-- Permite que o próprio ADMIN MBA seja identificado antes do segundo fator,
-- exclusivamente para que a interface possa iniciar o cadastro/desafio MFA.
drop policy if exists escola_super_admin_self_select on public.escola_super_admins;
create policy escola_super_admin_self_select
on public.escola_super_admins
for select
to authenticated
using (user_id = auth.uid() and ativo = true);
