-- Restore legitimate LavaGestor usage after enabling RLS while enforcing tenant isolation.
-- Anonymous users do not need direct access to convenience agreements.

revoke all privileges on table public.lava_convenios from anon;
grant select, insert, update, delete on table public.lava_convenios to authenticated, service_role;

drop policy if exists lava_convenios_company_access on public.lava_convenios;
create policy lava_convenios_company_access on public.lava_convenios
  for all
  to authenticated
  using (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('lavagestor')
    )
  )
  with check (
    public.is_admin_master()
    or (
      empresa_id = public.current_empresa_id()
      and public.can_access_app('lavagestor')
    )
  );
