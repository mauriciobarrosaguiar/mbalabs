-- The current MBA Cotações public-response flow is handled server-side with the admin client.
-- This legacy SECURITY DEFINER RPC exposes broad row payloads and is not referenced by current app code.
-- Remove anonymous execution while preserving authenticated/server compatibility.

revoke execute on function public.get_public_quote_payload(text) from public, anon;
grant execute on function public.get_public_quote_payload(text) to authenticated, service_role;
