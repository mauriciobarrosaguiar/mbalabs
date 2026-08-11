-- Legacy payload RPCs are not referenced by current application code.
-- Current flows are server-side. Restrict them to backend service_role only.

revoke execute on function public.lava_public_recibo_json(uuid) from authenticated;
revoke execute on function public.get_public_quote_payload(text) from authenticated;

grant execute on function public.lava_public_recibo_json(uuid) to service_role;
grant execute on function public.get_public_quote_payload(text) to service_role;
