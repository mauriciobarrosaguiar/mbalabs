-- MBA Escola: restringe RPCs e helpers escolares a usuários autenticados.
-- O módulo não possui API pública anônima; toda operação escolar exige sessão da MBA Labs.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'escola_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
  END LOOP;
END
$$;

ALTER FUNCTION public.escola_try_uuid(text)
  SET search_path = pg_catalog, public;
