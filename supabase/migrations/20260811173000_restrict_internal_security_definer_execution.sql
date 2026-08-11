-- Internal identity/access helper functions must not be callable anonymously.
-- Keep signed-in and server-side access because RLS and application code may depend on them.

revoke execute on function public.belongs_to_tenant(uuid) from public, anon;
revoke execute on function public.can_access_app(text) from public, anon;
revoke execute on function public.current_empresa_id() from public, anon;
revoke execute on function public.current_funcionario_id() from public, anon;
revoke execute on function public.current_user_profile_id() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.current_usuario_id() from public, anon;
revoke execute on function public.current_usuario_tipo() from public, anon;
revoke execute on function public.get_current_usuario() from public, anon;
revoke execute on function public.is_admin_master() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;

grant execute on function public.belongs_to_tenant(uuid) to authenticated, service_role;
grant execute on function public.can_access_app(text) to authenticated, service_role;
grant execute on function public.current_empresa_id() to authenticated, service_role;
grant execute on function public.current_funcionario_id() to authenticated, service_role;
grant execute on function public.current_user_profile_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.current_usuario_id() to authenticated, service_role;
grant execute on function public.current_usuario_tipo() to authenticated, service_role;
grant execute on function public.get_current_usuario() to authenticated, service_role;
grant execute on function public.is_admin_master() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
