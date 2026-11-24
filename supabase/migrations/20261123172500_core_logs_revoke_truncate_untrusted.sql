-- Harden the shared MBA Labs audit/event log against whole-table deletion.
-- PostgreSQL TRUNCATE does not consult row-level security; broad default grants
-- can therefore bypass DroneGestor row policies and affect unrelated apps.
-- Preserve SELECT/INSERT/UPDATE/DELETE grants and all existing RLS policies.
-- Authenticated web clients never need TRUNCATE on core_logs.
-- Rollback only if a verified backend requires it:
--   grant truncate on table public.core_logs to anon, authenticated;
revoke truncate on table public.core_logs from anon, authenticated;
