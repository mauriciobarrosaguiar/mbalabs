-- DroneGestor uses privileged server routes for every operational write. Authenticated
-- clients must not be able to forge OS/document/state rows or read another pilot's work.

create index if not exists idx_core_logs_dronegestor_company_user
  on public.core_logs (empresa_id, usuario_id)
  where app_slug = 'dronegestor';

-- IMPORTANT: core_logs is shared by multiple MBA Labs applications.
-- Preserve the already-deployed core_logs_select/core_logs_insert policies and their
-- existing grant semantics. Replacing those shared policies could deny reads/writes
-- to unrelated apps or introduce recursion through permission tables.
--
-- Every DroneGestor operational row is accessed via server routes that first
-- check session, tenant, role, OS assignment and state, then use service_role.
-- The authenticated/anon Supabase Data API MUST NOT read or mutate raw
-- DroneGestor event-store rows. Restrictive policies are intersected with ALL
-- permissive policies, including broad policies added in the future.
--
-- No GRANT/REVOKE on shared tables or functions is part of this migration.
-- Do not apply it to production without an approved maintenance window,
-- backout procedure, authenticated Data API tests and tenant regression checks.

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
