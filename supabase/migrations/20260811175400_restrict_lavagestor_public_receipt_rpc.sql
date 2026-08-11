-- Legacy receipt RPC exposed customer PII by raw lavagem UUID.
-- Current LavaGestor receipt/WhatsApp flow is server-side and authenticated, so anonymous
-- execution is unnecessary. Keep signed-in/server execution for compatibility.

revoke execute on function public.lava_public_recibo_json(uuid) from public, anon;
grant execute on function public.lava_public_recibo_json(uuid) to authenticated, service_role;
