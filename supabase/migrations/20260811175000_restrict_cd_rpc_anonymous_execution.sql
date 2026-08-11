-- ChamaDiarista SECURITY DEFINER RPCs already enforce auth.uid() and ownership/admin checks.
-- Remove unnecessary anonymous execution while preserving signed-in and server-side use.

revoke execute on function public.cd_accept_opportunity(uuid) from public, anon;
revoke execute on function public.cd_confirm_sandbox_payment(uuid) from public, anon;
revoke execute on function public.cd_find_nearby_professionals(uuid, integer, integer) from public, anon;
revoke execute on function public.cd_get_admin_geo_snapshot() from public, anon;
revoke execute on function public.cd_log_document_access(uuid, text) from public, anon;
revoke execute on function public.cd_record_location_event(uuid, double precision, double precision, integer, text) from public, anon;
revoke execute on function public.cd_submit_review(uuid, integer, text) from public, anon;
revoke execute on function public.cd_update_service_status(uuid, text, text, numeric, numeric, text) from public, anon;

grant execute on function public.cd_accept_opportunity(uuid) to authenticated, service_role;
grant execute on function public.cd_confirm_sandbox_payment(uuid) to authenticated, service_role;
grant execute on function public.cd_find_nearby_professionals(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.cd_get_admin_geo_snapshot() to authenticated, service_role;
grant execute on function public.cd_log_document_access(uuid, text) to authenticated, service_role;
grant execute on function public.cd_record_location_event(uuid, double precision, double precision, integer, text) to authenticated, service_role;
grant execute on function public.cd_submit_review(uuid, integer, text) to authenticated, service_role;
grant execute on function public.cd_update_service_status(uuid, text, text, numeric, numeric, text) to authenticated, service_role;
