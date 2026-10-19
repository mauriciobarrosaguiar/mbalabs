-- Não altera pedidos históricos. Bloqueia somente uma nova aprovação
-- quando a cotação exige pedido mínimo e há compra sem distribuidora válida.
CREATE OR REPLACE FUNCTION public.cot_require_order_distributor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.module_type = 'pharmacy'
     AND NEW.buyer_review_status = 'approved'
     AND OLD.buyer_review_status IS DISTINCT FROM 'approved'
     AND EXISTS (
       SELECT 1 FROM public.quotations q
       WHERE q.id = NEW.quotation_id AND q.tenant_id = NEW.tenant_id
         AND q.module_type = 'pharmacy' AND q.consider_minimum_order
     )
     AND EXISTS (
       SELECT 1 FROM public.purchase_order_items i
       LEFT JOIN public.distributors d
         ON d.id = i.distributor_id AND d.tenant_id = NEW.tenant_id
       WHERE i.purchase_order_id = NEW.id AND i.tenant_id = NEW.tenant_id
         AND i.quantity_to_buy > 0 AND d.id IS NULL
     ) THEN
    RAISE EXCEPTION 'Pedido com produto sem distribuidora cadastrada na farmacia. Identifique a distribuidora antes de aprovar: o pedido minimo esta ativo.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cot_require_order_distributor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cot_require_order_distributor() TO service_role;

DROP TRIGGER IF EXISTS cot_order_distributor_before_approval ON public.purchase_orders;
CREATE TRIGGER cot_order_distributor_before_approval
BEFORE UPDATE OF buyer_review_status ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.cot_require_order_distributor();
