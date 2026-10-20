-- Executar SOMENTE no projeto QA ulabbmjxdvxxiybhtgnn.
-- Cada cenário usa dados transitórios e desfaz seus próprios efeitos.
-- O ROLLBACK final também remove tabelas temporárias e funções de teste.
begin;
create temporary table qa_minimum_results(id text, status text, detail text);
create function pg_temp.qa_minimum_case(case_id text) returns void language plpgsql as $$
declare
 t uuid := '6e6f802c-2524-4ac1-9fdc-150c734b8866';
 other_t uuid := '6c73896b-6835-4bce-86ea-6f2138ea56ea';
 actor text := '5b8ee521-7145-4754-ae51-f804d4a5f175';
 q uuid := gen_random_uuid(); o uuid := gen_random_uuid();
 qi1 uuid := gen_random_uuid(); qi2 uuid := gen_random_uuid();
 i1 uuid := gen_random_uuid(); i2 uuid := gen_random_uuid();
 d1 uuid; d2 uuid; s uuid; edits jsonb; ex1 jsonb; ex2 jsonb; result jsonb;
 blocked boolean := false; ok boolean := false; msg text := '';
begin
 begin
  select id into d1 from distributors where tenant_id=t order by id limit 1;
  select id into d2 from distributors where tenant_id=t and id<>d1 order by id limit 1;
  select id into s from suppliers where tenant_id=t order by id limit 1;
  if d1 is null or d2 is null or s is null then raise exception 'Fixture QA incompleta'; end if;
  update distributors set pedido_minimo=500 where id in(d1,d2);
  insert into quotations(id,tenant_id,module_type,name,status,consider_minimum_order)
   values(q,t,'pharmacy','TESTE_QA RETOMADA '||case_id,'analyzing',true);
  insert into quotation_items(id,tenant_id,quotation_id,module_type,product_id,product_name,requested_quantity)
   select qi1,t,q,'pharmacy',id,nome,70 from products where tenant_id=t order by id limit 1;
  insert into quotation_items(id,tenant_id,quotation_id,module_type,product_id,product_name,requested_quantity)
   select qi2,t,q,'pharmacy',id,nome,70 from products where tenant_id=t order by id offset 1 limit 1;
  insert into purchase_orders(id,tenant_id,quotation_id,module_type,supplier_name,supplier_id,status,buyer_review_status)
   values(o,t,q,'pharmacy','TESTE_QA Representante',s,'gerado','pending');
  insert into purchase_order_items(id,tenant_id,purchase_order_id,quotation_item_id,product_name,quantity_to_buy,unit_price,total_price,distributor_id)
   values(i1,t,o,qi1,'TESTE_QA item 1',70,10,700,d1),(i2,t,o,qi2,'TESTE_QA item 2',0,10,0,d2);
  edits:=jsonb_build_array(jsonb_build_object('orderId',o,'itemId',i1,'quantity','35'),jsonb_build_object('orderId',o,'itemId',i2,'quantity','0'));
  ex1:=jsonb_build_object('orderId',o,'distributorId',d1,'confirmed',true,'reason','TESTE_QA compra urgente autorizada');
  ex2:=jsonb_build_object('orderId',o,'distributorId',d2,'confirmed',true,'reason','TESTE_QA segunda distribuidora autorizada');
  if case_id='G1' then
   edits:=jsonb_set(edits,'{0,quantity}','"70"');
   result:=cot_review_winner_orders_batch(t,q,actor,edits,true,'[]');
   ok:=(result->>'approvedOrders')::int=1 and (result->>'minimumExceptions')::int=0
    and (select total_amount=700 from purchase_orders where id=o);
  elsif case_id in ('G2-sem-confirmacao','G3-sem-motivo','G3-motivo-curto','G7-api-antiga') then
   begin
    if case_id='G7-api-antiga' then
     perform cot_review_winner_orders_batch(t,q,actor,edits,true);
    elsif case_id='G2-sem-confirmacao' then
     perform cot_review_winner_orders_batch(t,q,actor,edits,true,'[]');
    else
     ex1:=jsonb_set(ex1,'{reason}',to_jsonb(case when case_id='G3-sem-motivo' then '' else 'curto' end));
     perform cot_review_winner_orders_batch(t,q,actor,edits,true,jsonb_build_array(ex1));
    end if;
   exception when others then blocked:=true; msg:=sqlerrm; end;
   ok:=blocked and msg like '%abaixo do minimo%' and (select buyer_review_status='pending' from purchase_orders where id=o)
    and not exists(select 1 from cot_minimum_order_exceptions where quotation_id=q);
  elsif case_id in ('G2-confirmado','G6-auditoria') then
   result:=cot_review_winner_orders_batch(t,q,actor,edits,true,jsonb_build_array(ex1));
   ok:=(result->>'minimumExceptions')::int=1 and exists(
    select 1 from cot_minimum_order_exceptions where quotation_id=q and purchase_order_id=o
    and distributor_id=d1 and tenant_id=t and approved_amount=350 and minimum_amount=500 and shortfall=150
    and approved_by=actor and approved_at is not null and reason=ex1->>'reason')
    and exists(select 1 from audit_logs where tenant_id=t and metadata->>'quotationId'=q::text
      and metadata->>'shortfall'='150.00');
  elsif case_id='G4-reducao' then
   result:=cot_review_winner_orders_batch(t,q,actor,edits,false,'[]');
   ok:=(select total_amount=350 from purchase_orders where id=o);
   begin perform cot_review_winner_orders_batch(t,q,actor,edits,true,'[]');
   exception when others then blocked:=true; msg:=sqlerrm; end;
   ok:=ok and blocked and msg like '%abaixo do minimo%';
  elsif case_id in ('G5-uma-confirmacao','G5-duas-confirmacoes') then
   edits:=jsonb_set(edits,'{1,quantity}','"20"');
   if case_id='G5-uma-confirmacao' then
    begin perform cot_review_winner_orders_batch(t,q,actor,edits,true,jsonb_build_array(ex1));
    exception when others then blocked:=true; msg:=sqlerrm; end;
    ok:=blocked and msg like '%abaixo do minimo%'
     and not exists(select 1 from cot_minimum_order_exceptions where quotation_id=q);
   else
    result:=cot_review_winner_orders_batch(t,q,actor,edits,true,jsonb_build_array(ex1,ex2));
    ok:=(result->>'minimumExceptions')::int=2
     and (select count(*)=2 from cot_minimum_order_exceptions where quotation_id=q)
     and (select total_amount=550 from purchase_orders where id=o);
   end if;
  elsif case_id='G7-outra-farmacia' then
   begin perform cot_review_winner_orders_batch(other_t,q,actor,edits,true,jsonb_build_array(ex1));
   exception when others then blocked:=true; msg:=sqlerrm; end;
   ok:=blocked and msg like '%nao pertence a farmacia%';
  elsif case_id='G7-aprovacao-duplicada' then
   perform cot_review_winner_orders_batch(t,q,actor,edits,true,jsonb_build_array(ex1));
   begin perform cot_review_winner_orders_batch(t,q,actor,edits,true,jsonb_build_array(ex1));
   exception when others then blocked:=true; msg:=sqlerrm; end;
   ok:=blocked and msg like '%Nenhum pedido pendente%'
    and (select count(*)=1 from cot_minimum_order_exceptions where quotation_id=q);
  elsif case_id='G7-confirmacao-duplicada' then
   begin perform cot_review_winner_orders_batch(t,q,actor,edits,true,jsonb_build_array(ex1,ex1));
   exception when others then blocked:=true; msg:=sqlerrm; end;
   ok:=blocked and msg like '%duplicada%';
  elsif case_id='G6-imutabilidade-permissoes' then
   ok:=has_table_privilege('service_role','cot_minimum_order_exceptions','INSERT')
    and not has_table_privilege('service_role','cot_minimum_order_exceptions','UPDATE')
    and not has_table_privilege('service_role','cot_minimum_order_exceptions','DELETE')
    and not has_table_privilege('authenticated','cot_minimum_order_exceptions','INSERT')
    and not has_table_privilege('anon','cot_minimum_order_exceptions','SELECT');
  end if;
  if not ok and msg='' then msg:='Assercao nao satisfeita'; end if;
  raise exception using errcode='ZQ001',message='rollback do cenario';
 exception when sqlstate 'ZQ001' then null;
 when others then ok:=false; msg:=sqlerrm;
 end;
 insert into qa_minimum_results values(case_id,case when ok then 'APROVADO' else 'FALHOU' end,
  case when msg='' then 'Assercoes satisfeitas; efeitos desfeitos' else msg end);
end $$;
select pg_temp.qa_minimum_case(id) from unnest(array[
 'G1','G2-sem-confirmacao','G2-confirmado','G3-sem-motivo','G3-motivo-curto','G4-reducao',
 'G5-uma-confirmacao','G5-duas-confirmacoes','G6-auditoria','G6-imutabilidade-permissoes',
 'G7-outra-farmacia','G7-aprovacao-duplicada','G7-confirmacao-duplicada','G7-api-antiga']) id;
select * from qa_minimum_results order by id;
rollback;
