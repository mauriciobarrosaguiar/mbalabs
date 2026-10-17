-- Dados e regras de exceção só passam a valer quando esta migração for aplicada.
-- A migração mantém as cotações históricas intactas.
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS distributor_id uuid;

CREATE INDEX IF NOT EXISTS cot_po_items_distributor_idx
 ON public.purchase_order_items(tenant_id,purchase_order_id,distributor_id);

-- Preenchimento conservador de pedidos pendentes antigos: uma única oferta
-- inequívoca por item/representante/preço e dentro do mesmo tenant.
WITH matches AS (
  SELECT pi.id item_id,min(sri.distributor_id) distributor_id,
    count(DISTINCT sri.distributor_id) n
  FROM public.purchase_order_items pi
  JOIN public.purchase_orders po
    ON po.id=pi.purchase_order_id AND po.tenant_id=pi.tenant_id
  JOIN public.supplier_quote_response_items sri
    ON sri.tenant_id=po.tenant_id AND sri.quotation_id=po.quotation_id
    AND sri.quotation_item_id=pi.quotation_item_id
    AND sri.supplier_id=po.supplier_id AND sri.unit_price=pi.unit_price
  JOIN public.distributors d
    ON d.id=sri.distributor_id AND d.tenant_id=po.tenant_id
  WHERE pi.distributor_id IS NULL AND po.buyer_review_status='pending'
    AND po.buyer_sent_at IS NULL
  GROUP BY pi.id
)
UPDATE public.purchase_order_items pi SET distributor_id=m.distributor_id
 FROM matches m WHERE pi.id=m.item_id AND m.n=1;

-- Registro específico e imutável de cada aprovação abaixo do mínimo.
CREATE TABLE IF NOT EXISTS public.cot_minimum_order_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quotation_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  distributor_id uuid NOT NULL,
  distributor_name text NOT NULL,
  approved_amount numeric(18,2) NOT NULL CHECK (approved_amount>0),
  minimum_amount numeric(18,2) NOT NULL CHECK (minimum_amount>approved_amount),
  shortfall numeric(18,2) NOT NULL CHECK (shortfall>0),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 500),
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cot_minimum_exception_order_distributor UNIQUE(purchase_order_id,distributor_id)
);

CREATE INDEX IF NOT EXISTS cot_minimum_exceptions_tenant_idx
 ON public.cot_minimum_order_exceptions(tenant_id,quotation_id,approved_at DESC);

ALTER TABLE public.cot_minimum_order_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cot_minimum_order_exceptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.cot_minimum_order_exceptions TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.cot_minimum_order_exceptions FROM service_role;

-- Assinatura com p_exceptions; antigos chamadores continuam podendo omiti-lo,
-- mas nunca aprovam um valor abaixo do mínimo sem justificativa.
DROP FUNCTION IF EXISTS public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean);

-- Revisão conjunta e atômica de TODOS os pedidos vencedores da cotação.
-- A função é acessível somente ao service_role; a API autentica empresa e comprador.
CREATE OR REPLACE FUNCTION public.cot_review_winner_orders_batch(
  p_tenant_id uuid,
  p_quotation_id uuid,
  p_actor text,
  p_items jsonb,
  p_approve boolean DEFAULT false,
  p_exceptions jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_order record;
  v_item record;
  v_edit jsonb;
  v_quantity numeric;
  v_old_package numeric;
  v_new_package numeric;
  v_note text;
  v_rows integer;
  v_orders integer := 0;
  v_items integer := 0;
  v_changed integer := 0;
  v_approved integer := 0;
  v_minimum_enabled boolean := false;
  v_minimum record;
  v_exception jsonb;
  v_minimum_exceptions integer := 0;
BEGIN
  IF p_tenant_id IS NULL OR p_quotation_id IS NULL OR nullif(btrim(p_actor),'') IS NULL
    THEN RAISE EXCEPTION 'Identificacao do comprador e da farmacia obrigatoria.'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) > 2000
    THEN RAISE EXCEPTION 'Lista de produtos invalida ou grande demais.'; END IF;
  IF jsonb_typeof(p_exceptions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_exceptions) > 200
    THEN RAISE EXCEPTION 'Confirmacoes excepcionais invalidas.'; END IF;
  -- Trava a cotação para preservar a configuração ao longo da aprovação.
  SELECT q.consider_minimum_order INTO v_minimum_enabled
  FROM public.quotations q
  WHERE q.id = p_quotation_id AND q.tenant_id = p_tenant_id AND q.module_type = 'pharmacy'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotacao nao pertence a farmacia ou nao e cotacao de farmacia.'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_exceptions) x
    GROUP BY x->>'orderId', x->>'distributorId' HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Confirmacao de minimo duplicada.'; END IF;

  -- O lock evita que duas aprovações simultâneas gerem revisões concorrentes.
  FOR v_order IN
    SELECT id, status FROM public.purchase_orders
     WHERE quotation_id = p_quotation_id AND tenant_id = p_tenant_id
       AND module_type = 'pharmacy' AND buyer_review_status = 'pending'
       AND buyer_sent_at IS NULL AND status IN ('gerado','draft')
     ORDER BY id FOR UPDATE
  LOOP
    v_orders := v_orders + 1;
  END LOOP;
  IF v_orders = 0 THEN
    RAISE EXCEPTION 'Nenhum pedido pendente de revisao. Atualize a pagina antes de tentar novamente.';
  END IF;

  -- Exige uma linha de revisão para cada item de todos os pedidos pendentes.
  SELECT count(*) INTO v_items FROM public.purchase_order_items item
    JOIN public.purchase_orders ord ON ord.id = item.purchase_order_id
    WHERE ord.tenant_id = p_tenant_id AND ord.quotation_id = p_quotation_id
      AND ord.module_type = 'pharmacy' AND ord.buyer_review_status = 'pending'
      AND ord.buyer_sent_at IS NULL AND ord.status IN ('gerado','draft');
  IF v_items <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'Os produtos mudaram enquanto voce revisava. Atualize para continuar.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) x
     GROUP BY x->>'itemId' HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Produto duplicado na revisao.'; END IF;

  FOR v_edit IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_edit->>'itemId') IS NULL OR (v_edit->>'orderId') IS NULL
       OR (v_edit->>'quantity') IS NULL OR (v_edit->>'quantity') !~ '^[0-9]{1,7}([.][0-9]{1,3})?$'
    THEN RAISE EXCEPTION 'Identificador ou quantidade de produto invalido.'; END IF;
    v_quantity := (v_edit->>'quantity')::numeric;
    IF v_quantity < 0 OR v_quantity > 1000000 THEN
      RAISE EXCEPTION 'Quantidade fora do limite permitido.'; END IF;

    SELECT item.id, item.purchase_order_id, item.quantity_to_buy, item.packages_to_buy,
           item.unit_price, item.buyer_change_note
      INTO v_item FROM public.purchase_order_items item
      JOIN public.purchase_orders ord ON ord.id = item.purchase_order_id
     WHERE item.id = (v_edit->>'itemId')::uuid
       AND item.purchase_order_id = (v_edit->>'orderId')::uuid
       AND item.tenant_id = p_tenant_id
       AND ord.tenant_id = p_tenant_id AND ord.quotation_id = p_quotation_id
       AND ord.buyer_review_status = 'pending'
       AND ord.buyer_sent_at IS NULL AND ord.status IN ('gerado','draft')
     FOR UPDATE OF item;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item fora da cotacao ou pedido ja aprovado.'; END IF;
    v_note := left(btrim(coalesce(v_edit->>'note','')),500);
    IF v_quantity IS DISTINCT FROM v_item.quantity_to_buy THEN
      IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
        RAISE EXCEPTION 'Preco unitario invalido para revisar a quantidade.'; END IF;
      -- Preserva a proporção da embalagem, sem alterar o preço unitário ofertado.
      v_old_package := v_item.packages_to_buy;
      v_new_package := CASE
        WHEN v_old_package IS NULL THEN NULL
        WHEN v_item.quantity_to_buy > 0
          THEN round(v_old_package * v_quantity / v_item.quantity_to_buy,3)
        WHEN v_quantity = 0 THEN 0
        ELSE v_quantity END;

      UPDATE public.purchase_order_items SET
        quantity_to_buy = v_quantity,
        packages_to_buy = v_new_package,
        total_price = round(v_quantity * v_item.unit_price,4),
        missing_quantity = v_quantity,
        buyer_change_note = nullif(v_note,''),
        supplier_confirmation_note = NULL,
        buyer_changed_by = p_actor
      WHERE id = v_item.id AND purchase_order_id = v_item.purchase_order_id
        AND tenant_id = p_tenant_id;
      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  -- Recalcula totais reais após a edição (incluindo alterações feitas em lote),
  -- evitando aprovação com total_amount antigo e falso cumprimento do mínimo.
  UPDATE public.purchase_orders o SET total_amount = coalesce((
    SELECT round(sum(coalesce(i.quantity_to_buy,0)*coalesce(i.unit_price,0)),2)
    FROM public.purchase_order_items i
    WHERE i.purchase_order_id=o.id AND i.tenant_id=p_tenant_id
  ),0), updated_at=now()
  WHERE o.quotation_id=p_quotation_id AND o.tenant_id=p_tenant_id
    AND o.module_type='pharmacy' AND o.buyer_review_status='pending'
    AND o.buyer_sent_at IS NULL AND o.status IN ('gerado','draft');

  IF NOT p_approve AND jsonb_array_length(p_exceptions) > 0 THEN
    RAISE EXCEPTION 'A confirmacao excepcional somente e permitida na aprovacao.'; END IF;

  IF p_approve THEN
    IF v_minimum_enabled THEN
      -- A mesma farmácia é exigida em TODAS as junções; nenhuma exceção
      -- para outra cotação/empresa poderá ser aproveitada.
      FOR v_minimum IN
        SELECT o.id order_id,d.id distributor_id,d.nome distributor_name,
          d.pedido_minimo minimum_amount,
          round(sum(i.quantity_to_buy*i.unit_price),2) approved_amount
        FROM public.purchase_orders o
        JOIN public.purchase_order_items i
          ON i.purchase_order_id=o.id AND i.tenant_id=o.tenant_id
        JOIN public.distributors d
          ON d.id=i.distributor_id AND d.tenant_id=o.tenant_id
        WHERE o.quotation_id=p_quotation_id AND o.tenant_id=p_tenant_id
          AND o.module_type='pharmacy' AND o.buyer_review_status='pending'
          AND o.buyer_sent_at IS NULL AND o.status IN ('gerado','draft')
          AND d.pedido_minimo>0
        GROUP BY o.id,d.id,d.nome,d.pedido_minimo
        HAVING sum(i.quantity_to_buy*i.unit_price)>0
           AND round(sum(i.quantity_to_buy*i.unit_price),2)<d.pedido_minimo
        ORDER BY o.id,d.id
      LOOP
        SELECT x.value INTO v_exception
        FROM jsonb_array_elements(p_exceptions) x
        WHERE x.value->>'orderId'=v_minimum.order_id::text
          AND x.value->>'distributorId'=v_minimum.distributor_id::text;
        IF v_exception IS NULL OR v_exception->>'confirmed' IS DISTINCT FROM 'true'
          OR char_length(btrim(coalesce(v_exception->>'reason',''))) < 10
          OR char_length(btrim(coalesce(v_exception->>'reason',''))) > 500 THEN
          RAISE EXCEPTION 'Pedido abaixo do minimo da distribuidora %. Confirme a excecao e informe justificativa de 10 a 500 caracteres.',v_minimum.distributor_name;
        END IF;

        INSERT INTO public.cot_minimum_order_exceptions(
          tenant_id,quotation_id,purchase_order_id,distributor_id,
          distributor_name,approved_amount,minimum_amount,shortfall,
          reason,approved_by
        ) VALUES (
          p_tenant_id,p_quotation_id,v_minimum.order_id,v_minimum.distributor_id,
          v_minimum.distributor_name,v_minimum.approved_amount,v_minimum.minimum_amount,
          v_minimum.minimum_amount-v_minimum.approved_amount,
          btrim(v_exception->>'reason'),p_actor
        );

        -- Também aparece no log administrativo, com todas as grandezas aprovadas.
        INSERT INTO public.audit_logs(tenant_id,actor,action,entity,severity,metadata)
        VALUES(
          p_tenant_id,p_actor,'Excecao de pedido minimo aprovada',
          'cot_minimum_order_exceptions','warning',
          jsonb_build_object('quotationId',p_quotation_id,'orderId',v_minimum.order_id,
            'distributorId',v_minimum.distributor_id,'distributorName',v_minimum.distributor_name,
            'approvedAmount',v_minimum.approved_amount,'minimumAmount',v_minimum.minimum_amount,
            'shortfall',v_minimum.minimum_amount-v_minimum.approved_amount,
            'reason',btrim(v_exception->>'reason'))
        );
        v_minimum_exceptions:=v_minimum_exceptions+1;
        v_exception:=NULL;
      END LOOP;
    END IF;
    IF v_minimum_exceptions<>jsonb_array_length(p_exceptions) THEN
      RAISE EXCEPTION 'Confirmacao de minimo nao corresponde aos pedidos pendentes. Atualize a pagina.'; END IF;
    -- Não permite envio de pedidos sem nenhum item comprado.
    IF EXISTS (
      SELECT 1 FROM public.purchase_orders ord
       WHERE ord.quotation_id = p_quotation_id AND ord.tenant_id = p_tenant_id
         AND ord.buyer_review_status = 'pending' AND ord.status IN ('gerado','draft')
         AND NOT EXISTS (
           SELECT 1 FROM public.purchase_order_items item
            WHERE item.purchase_order_id = ord.id AND item.quantity_to_buy > 0
         )
    ) THEN RAISE EXCEPTION 'Um dos pedidos ficou sem produtos. Mantenha um item com quantidade maior que zero ou ajuste a cotacao.'; END IF;
    UPDATE public.purchase_orders SET
      buyer_review_status = 'approved',
      buyer_approved_at = now(),
      buyer_approved_by = p_actor,
      updated_at = now()
    WHERE quotation_id = p_quotation_id AND tenant_id = p_tenant_id
      AND buyer_review_status = 'pending' AND buyer_sent_at IS NULL
      AND status IN ('gerado','draft');
    GET DIAGNOSTICS v_approved = ROW_COUNT;
    IF v_approved <> v_orders THEN
      RAISE EXCEPTION 'Pedidos alterados durante a aprovacao. Atualize e tente novamente.'; END IF;
  END IF;

  RETURN jsonb_build_object('ok',true,'orders',v_orders,'items',v_items,
    'changedItems',v_changed,'approvedOrders',v_approved,'minimumExceptions',v_minimum_exceptions);
END;
$body$;

REVOKE ALL ON FUNCTION public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean,jsonb)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean,jsonb)
 TO service_role;
