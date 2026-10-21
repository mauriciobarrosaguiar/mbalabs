-- Cotações por empresa e por mês, independentemente do cliente HTTP utilizado.
-- A contagem inclui cotações canceladas/excluídas para evitar zerar a franquia
-- apagando históricos. Mês de referência: fuso America/Sao_Paulo.
CREATE INDEX IF NOT EXISTS cot_quotations_tenant_month_idx
  ON public.quotations(tenant_id, created_at);

CREATE OR REPLACE FUNCTION public.cot_enforce_monthly_quotation_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_used bigint;
  v_start timestamptz;
  v_end timestamptz;
  v_local_month timestamp;
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;

  -- A trava por empresa impede ultrapassar o limite em requisições simultâneas.
  PERFORM pg_advisory_xact_lock(hashtext('mba-cot-quota'), hashtext(NEW.tenant_id::text));

  SELECT sp.max_quotations_month
    INTO v_limit
    FROM public.tenants t
    JOIN public.subscription_plans sp ON sp.id = t.plano_id
   WHERE t.id = NEW.tenant_id;

  -- Empresas sem plano não recebem bloqueio implícito: exigir plano
  -- deve ser uma política separada, não uma alteração retroativa.
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  v_local_month := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo');
  v_start := v_local_month AT TIME ZONE 'America/Sao_Paulo';
  v_end := (v_local_month + interval '1 month') AT TIME ZONE 'America/Sao_Paulo';

  SELECT COUNT(*) INTO v_used
    FROM public.quotations
   WHERE tenant_id = NEW.tenant_id
     AND created_at >= v_start
     AND created_at < v_end;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Limite mensal de cotações atingido (% de %). Solicite alteração do plano ao administrador.', v_used, v_limit
      USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cot_quotation_monthly_limit ON public.quotations;
CREATE TRIGGER cot_quotation_monthly_limit
BEFORE INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.cot_enforce_monthly_quotation_limit();

REVOKE ALL ON FUNCTION public.cot_enforce_monthly_quotation_limit() FROM PUBLIC, anon, authenticated;
