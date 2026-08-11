-- Harden public functions reported by the Supabase security advisor.
-- No business logic changes: only pin the object resolution path.

alter function public.set_updated_at() set search_path = public, pg_catalog;
alter function public.guard_supplier_response_write() set search_path = public, pg_catalog;
alter function public.guard_supplier_response_item_write() set search_path = public, pg_catalog;
alter function public.guard_supplier_session_reopen_when_quotation_closed() set search_path = public, pg_catalog;
alter function public.set_purchase_order_review_updated_at() set search_path = public, pg_catalog;
alter function public.sync_core_usuario_tipo() set search_path = public, pg_catalog;
alter function public.sync_core_app_legacy() set search_path = public, pg_catalog;
alter function public.validate_usuario_app_permissao() set search_path = public, pg_catalog;
alter function public.only_digits(text) set search_path = public, pg_catalog;
alter function public.validate_core_empresa_cnpj_unique() set search_path = public, pg_catalog;
alter function public.validate_core_plan_matches_app() set search_path = public, pg_catalog;
alter function public.lava_configuracoes_touch_updated_at() set search_path = public, pg_catalog;
