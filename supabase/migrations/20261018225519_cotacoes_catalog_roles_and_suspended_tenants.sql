-- QA E2E: preservar leitura por tenant e limitar alterações cadastrais.
-- Não concede permissões a tenants suspensos nem a vínculos inativos.
create or replace function public.belongs_to_tenant(target_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.tenant_users tu
    join public.tenants t on t.id = tu.tenant_id
    where tu.tenant_id = target_tenant_id
      and tu.user_profile_id = public.current_user_profile_id()
      and tu.status = 'ativo'
      and t.status in ('ativo', 'teste')
  );
$function$;

create or replace function public.can_manage_cotacoes_catalog(target_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.tenant_users tu
    join public.tenants t on t.id = tu.tenant_id
    where tu.tenant_id = target_tenant_id
      and tu.user_profile_id = public.current_user_profile_id()
      and tu.status = 'ativo'
      and tu.role in ('ADMIN_EMPRESA', 'COMPRADOR')
      and t.status in ('ativo', 'teste')
  );
$function$;
revoke all on function public.can_manage_cotacoes_catalog(uuid) from public, anon;
grant execute on function public.can_manage_cotacoes_catalog(uuid) to authenticated, service_role;

do $policies$
declare table_name text;
begin
  foreach table_name in array array['products','laboratories','suppliers','distributors','pharmacies']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_tenant_access', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_super_admin() or public.belongs_to_tenant(tenant_id))', table_name || '_tenant_read', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_super_admin() or public.can_manage_cotacoes_catalog(tenant_id))', table_name || '_tenant_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_super_admin() or public.can_manage_cotacoes_catalog(tenant_id)) with check (public.is_super_admin() or public.can_manage_cotacoes_catalog(tenant_id))', table_name || '_tenant_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_super_admin() or public.can_manage_cotacoes_catalog(tenant_id))', table_name || '_tenant_delete', table_name);
  end loop;
end
$policies$;
