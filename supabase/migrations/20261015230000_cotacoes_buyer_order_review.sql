-- Etapa de revisão de pedidos após encerramento da cotação.
-- Preserva pedidos antigos: somente pedidos NOVOS começam aguardando aprovação.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS buyer_review_status text NOT NULL DEFAULT 'pending'
    CHECK (buyer_review_status IN ('pending', 'approved')),
  ADD COLUMN IF NOT EXISTS buyer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_approved_by text,
  ADD COLUMN IF NOT EXISTS buyer_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_minimum_checked_at timestamptz;

UPDATE public.purchase_orders
   SET buyer_review_status = 'approved'
 WHERE buyer_review_status = 'pending';

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS initial_quantity_to_buy numeric(14,3),
  ADD COLUMN IF NOT EXISTS buyer_change_note text,
  ADD COLUMN IF NOT EXISTS supplier_confirmation_note text,
  ADD COLUMN IF NOT EXISTS buyer_changed_by text,
  ADD COLUMN IF NOT EXISTS buyer_changed_at timestamptz;
UPDATE public.purchase_order_items
   SET initial_quantity_to_buy = quantity_to_buy
 WHERE initial_quantity_to_buy IS NULL;

CREATE TABLE IF NOT EXISTS public.cot_order_quantity_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  purchase_order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id),
  before_quantity numeric(14,3) NOT NULL,
  after_quantity numeric(14,3) NOT NULL,
  before_total numeric(14,4) NOT NULL,
  after_total numeric(14,4) NOT NULL,
  note text,
  supplier_confirmation_note text,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cot_order_quantity_changes_order_idx
 ON public.cot_order_quantity_changes (tenant_id, purchase_order_id, changed_at DESC);
ALTER TABLE public.cot_order_quantity_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cot_order_quantity_changes FROM anon, authenticated;
GRANT SELECT, INSERT ON public.cot_order_quantity_changes TO service_role;

CREATE OR REPLACE FUNCTION public.cot_order_item_review_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE review_status text; quote_id uuid; owner_tenant uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.initial_quantity_to_buy = COALESCE(NEW.initial_quantity_to_buy, NEW.quantity_to_buy);
    RETURN NEW;
  END IF;
  IF NEW.initial_quantity_to_buy IS DISTINCT FROM OLD.initial_quantity_to_buy THEN
    RAISE EXCEPTION 'Quantidade original da cotacao e imutavel.';
  END IF;
  IF NEW.quantity_to_buy IS NOT DISTINCT FROM OLD.quantity_to_buy THEN RETURN NEW; END IF;

  SELECT buyer_review_status, quotation_id, tenant_id INTO review_status, quote_id, owner_tenant
  FROM public.purchase_orders WHERE id = NEW.purchase_order_id FOR UPDATE;
  IF review_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'O pedido aprovado/enviado nao pode ter a quantidade alterada.';
  END IF;
  IF NEW.buyer_changed_by IS NULL OR length(btrim(NEW.buyer_changed_by)) = 0 THEN
    RAISE EXCEPTION 'Identificacao do comprador obrigatoria.';
  END IF;
  IF NEW.quantity_to_buy < 0 THEN RAISE EXCEPTION 'Quantidade invalida.'; END IF;
  IF NEW.tenant_id IS DISTINCT FROM owner_tenant THEN RAISE EXCEPTION 'Empresa do pedido nao confere.'; END IF;

  NEW.buyer_changed_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cot_order_item_review_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE parent_quotation uuid;
BEGIN
  IF NEW.quantity_to_buy IS NOT DISTINCT FROM OLD.quantity_to_buy THEN RETURN NEW; END IF;
  SELECT quotation_id INTO parent_quotation FROM public.purchase_orders WHERE id = NEW.purchase_order_id;
  INSERT INTO public.cot_order_quantity_changes (
    tenant_id, quotation_id, purchase_order_id, purchase_order_item_id,
    before_quantity, after_quantity, before_total, after_total,
    note, supplier_confirmation_note, changed_by
  ) VALUES (
    NEW.tenant_id, parent_quotation, NEW.purchase_order_id, NEW.id,
    OLD.quantity_to_buy, NEW.quantity_to_buy, OLD.total_price, NEW.total_price,
    NEW.buyer_change_note, NEW.supplier_confirmation_note, NEW.buyer_changed_by
  );
  UPDATE public.purchase_orders SET
    total_amount = COALESCE((
      SELECT round(sum(total_price), 4) FROM public.purchase_order_items
      WHERE purchase_order_id = NEW.purchase_order_id
    ), 0),
    updated_at = now()
  WHERE id = NEW.purchase_order_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cot_order_item_review_guard ON public.purchase_order_items;
CREATE TRIGGER trg_cot_order_item_review_guard
BEFORE INSERT OR UPDATE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.cot_order_item_review_guard();

DROP TRIGGER IF EXISTS trg_cot_order_item_review_audit ON public.purchase_order_items;
CREATE TRIGGER trg_cot_order_item_review_audit
AFTER UPDATE OF quantity_to_buy ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.cot_order_item_review_audit();

REVOKE ALL ON FUNCTION public.cot_order_item_review_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cot_order_item_review_audit() FROM PUBLIC;
COMMENT ON COLUMN public.purchase_orders.buyer_review_status IS 'pending: comprador deve revisar antes de transmitir; approved: liberado para envio';
