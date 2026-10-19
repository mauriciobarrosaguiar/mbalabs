-- Somente QA ulabbmjxdvxxiybhtgnn. Regressão específica, sem persistir fixtures.
BEGIN;
CREATE TEMP TABLE qa_unlinked_results (scenario text, passed boolean, detail text);
DO $$
DECLARE
  t uuid := '6e6f802c-2524-4ac1-9fdc-150c734b8866';
  other_t uuid := '6c73896b-6835-4bce-86ea-6f2138ea56ea';
  q uuid; o uuid; qi uuid; i uuid; d uuid; s uuid; foreign_d uuid;
  scenario text; result jsonb; blocked boolean; msg text; edits jsonb;
BEGIN
  SELECT id INTO d FROM public.distributors WHERE tenant_id=t LIMIT 1;
  SELECT id INTO foreign_d FROM public.distributors WHERE tenant_id=other_t LIMIT 1;
  SELECT id INTO s FROM public.suppliers WHERE tenant_id=t LIMIT 1;
  IF d IS NULL OR s IS NULL OR foreign_d IS NULL THEN RAISE EXCEPTION 'Fixture QA incompleta'; END IF;
  FOREACH scenario IN ARRAY ARRAY['sem-vinculo','outra-farmacia','minimo-desativado','vinculo-valido'] LOOP
    BEGIN
      q:=gen_random_uuid(); o:=gen_random_uuid(); qi:=gen_random_uuid(); i:=gen_random_uuid();
      UPDATE public.distributors SET pedido_minimo=0 WHERE id=d AND tenant_id=t;
      INSERT INTO public.quotations(id,tenant_id,module_type,name,status,consider_minimum_order)
        VALUES(q,t,'pharmacy','TESTE_QA REGRESSAO VINCULO','finished',scenario<>'minimo-desativado');
      INSERT INTO public.quotation_items(id,tenant_id,quotation_id,module_type,product_name,requested_quantity)
        VALUES(qi,t,q,'pharmacy','TESTE_QA REGRESSAO',20);
      INSERT INTO public.purchase_orders(id,tenant_id,quotation_id,module_type,supplier_id,supplier_name,status,buyer_review_status)
        VALUES(o,t,q,'pharmacy',s,'TESTE_QA REGRESSAO','gerado','pending');
      INSERT INTO public.purchase_order_items(id,tenant_id,purchase_order_id,quotation_item_id,product_name,quantity_to_buy,unit_price,total_price,distributor_id)
        VALUES(i,t,o,qi,'TESTE_QA REGRESSAO',20,35,700,
          CASE WHEN scenario='outra-farmacia' THEN foreign_d WHEN scenario='vinculo-valido' THEN d ELSE NULL END);
      edits:=jsonb_build_array(jsonb_build_object('orderId',o,'itemId',i,'quantity','10'));
      blocked:=false; msg:='';
      BEGIN
        result:=public.cot_review_winner_orders_batch(t,q,'TESTE_QA REGRESSAO',edits,true,'[]');
      EXCEPTION WHEN OTHERS THEN blocked:=true; msg:=SQLERRM; END;
      IF scenario IN ('sem-vinculo','outra-farmacia') THEN
        IF NOT blocked OR msg NOT LIKE '%sem distribuidora cadastrada%'
          OR NOT EXISTS(SELECT 1 FROM public.purchase_orders WHERE id=o AND buyer_review_status='pending' AND total_amount=0)
          OR NOT EXISTS(SELECT 1 FROM public.purchase_order_items WHERE id=i AND quantity_to_buy=20)
          OR EXISTS(SELECT 1 FROM public.cot_minimum_order_exceptions WHERE quotation_id=q) THEN
          RAISE EXCEPTION 'Regressao falhou: %; %',scenario,msg;
        END IF;
      ELSIF blocked OR (result->>'approvedOrders')::int<>1 THEN
        RAISE EXCEPTION 'Regressao falhou: %; %',scenario,msg;
      END IF;
      -- Desfaz todos os dados do caso, inclusive o mínimo temporário.
      RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='QA_CASE_ROLLBACK:'||scenario;
    EXCEPTION WHEN no_data_found THEN
      IF SQLERRM NOT LIKE 'QA_CASE_ROLLBACK:%' THEN RAISE; END IF;
      INSERT INTO qa_unlinked_results VALUES(scenario,true,'Efeitos desfeitos');
    END;
  END LOOP;
END;
$$;
SELECT * FROM qa_unlinked_results;
ROLLBACK;
