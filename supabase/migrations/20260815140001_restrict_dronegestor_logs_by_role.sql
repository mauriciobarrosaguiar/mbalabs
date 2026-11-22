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

-- Defense in depth: core_logs is an internal event store, not a client API.
-- usuario_id is the AUTHOR (e.g. RT creating an OS for Pedro), not necessarily
-- the assigned pilot. Ownership/assignment/document authorization is resolved
-- by the server routes. Never expose these raw payloads through PostgREST.
-- RESTRICTIVE policies also intersect any existing/future permissive policy.
-- Other modules retain their existing policies and grants without alteration.
drop policy if exists dronegestor_logs_api_select on public.core_logs;
create policy dronegestor_logs_api_select on public.core_logs
  as restrictive for select to anon, authenticated
  using (app_slug is distinct from 'dronegestor');
drop policy if exists dronegestor_logs_api_insert on public.core_logs;
create policy dronegestor_logs_api_insert on public.core_logs
  as restrictive for insert to anon, authenticated
  with check (app_slug is distinct from 'dronegestor');
drop policy if exists dronegestor_logs_api_update on public.core_logs;
create policy dronegestor_logs_api_update on public.core_logs
  as restrictive for update to anon, authenticated
  using (app_slug is distinct from 'dronegestor')
  with check (app_slug is distinct from 'dronegestor');
drop policy if exists dronegestor_logs_api_delete on public.core_logs;
create policy dronegestor_logs_api_delete on public.core_logs
  as restrictive for delete to anon, authenticated
  using (app_slug is distinct from 'dronegestor');
