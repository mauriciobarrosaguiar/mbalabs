-- DroneGestor uses privileged server routes for every operational write. Authenticated
-- clients must not be able to forge OS/document/state rows or read another pilot's work.

create index if not exists idx_core_logs_dronegestor_company_user
  on public.core_logs (empresa_id, usuario_id)
  where app_slug = 'dronegestor';

drop policy if exists core_logs_select on public.core_logs;
create policy core_logs_select on public.core_logs
  for select to authenticated
  using (
    (select public.is_admin_master())
    or (
      empresa_id = (select public.current_empresa_id())
      and (
        app_slug is distinct from 'dronegestor'
        or usuario_id = (select public.current_usuario_id())
        or (select public.current_usuario_tipo()) = 'admin_empresa'
        or exists (
          select 1
          from public.core_usuario_app_permissoes permission
          join public.core_apps app on app.id = permission.app_id
          where permission.usuario_id = (select public.current_usuario_id())
            and permission.empresa_id = public.core_logs.empresa_id
            and permission.status = 'ativo'
            and app.slug = 'dronegestor'
            and permission.perfil_app in ('admin_empresa', 'gestor_operacional', 'responsavel_tecnico', 'rt')
        )
      )
    )
  );

drop policy if exists core_logs_insert on public.core_logs;
create policy core_logs_insert on public.core_logs
  for insert to authenticated
  with check (
    (select public.is_admin_master())
    or (
      app_slug is distinct from 'dronegestor'
      and empresa_id = (select public.current_empresa_id())
    )
  );
