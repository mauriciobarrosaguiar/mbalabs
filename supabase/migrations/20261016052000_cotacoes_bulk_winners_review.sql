-- Revisão conjunta e atômica de TODOS os pedidos vencedores da cotação.
-- A função é acessível somente ao service_role; a API autentica empresa e comprador.
CREATE OR REPLACE FUNCTION public.cot_review_winner_orders_batch(
  p_tenant_id uuid,
  p_quotation_id uuid,
  p_actor text,
  p_items jsonb,
  p_approve boolean DEFAULT false
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
BEGIN
  IF p_tenant_id IS NULL OR p_quotation_id IS NULL OR nullif(btrim(p_actor),'') IS NULL
    THEN RAISE EXCEPTION 'Identificacao do comprador e da farmacia obrigatoria.'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) > 2000
    THEN RAISE EXCEPTION 'Lista de produtos invalida ou grande demais.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quotations
    WHERE id = p_quotation_id AND tenant_id = p_tenant_id AND module_type = 'pharmacy')
    THEN RAISE EXCEPTION 'Cotacao nao pertence a farmacia ou nao e cotacao de farmacia.'; END IF;

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
       OR (v_edit->>'quantity') IS NULL OR (v_edit->>'quantity') !~ '^[0-9]{1,7}([.][0-9]{1,3})?
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

  IF p_approve THEN
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
    'changedItems',v_changed,'approvedOrders',v_approved);
END;
$body$;

REVOKE ALL ON FUNCTION public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean)
 TO service_role;

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

  IF p_approve THEN
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
    'changedItems',v_changed,'approvedOrders',v_approved);
END;
$body$;

REVOKE ALL ON FUNCTION public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cot_review_winner_orders_batch(uuid,uuid,text,jsonb,boolean)
 TO service_role;
