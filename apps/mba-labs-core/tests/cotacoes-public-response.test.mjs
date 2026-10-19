import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test,{beforeEach} from 'node:test';
import {state,reset} from './helpers/cotacoes-public-fixture.mjs';
const fixture=new URL('./helpers/cotacoes-public-fixture.mjs',import.meta.url).href;
const hooks=registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(specifier==='@/modules/cotacoes/lib/supabase/server')return {url:fixture,shortCircuit:true};
 if(specifier.startsWith('@/modules/cotacoes/'))return {url:new URL('../src/'+specifier.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const {getPublicQuoteByToken:get,savePublicSellerResponse:save}=await import('../src/modules/cotacoes/lib/data/public-response-repository.ts');
hooks.deregister();beforeEach(reset);
const input=extra=>({moduleType:'pharmacy',status:'draft',rows:[{quotationItemId:'item-A',netPrice:'10,00'}],...extra});
test('link inválido não expõe cotação',async()=>assert.equal(await get('invalid-test-link','pharmacy'),null));
test('link inválido não permite gravação',async()=>{await assert.rejects(()=>save('invalid-test-link',input()),/inválido/);assert.equal(state.writes.length,0);});
test('módulo diferente não expõe cotação',async()=>assert.equal(await get('test-link-A','bidding'),null));
test('cotação excluída não expõe dados',async()=>{state.tables.quotations[0].deleted_at='2026-10-17';assert.equal(await get('test-link-A','pharmacy'),null);});
test('link expirado bloqueia escrita',async()=>{state.tables.supplier_quote_sessions[0].expires_at='2000-01-01';await assert.rejects(()=>save('test-link-A',input()),/expirou/);assert.equal(state.writes.length,0);});
test('resposta enviada bloqueia reenvio e edição',async()=>{state.tables.supplier_quote_sessions[0].status='submitted';await assert.rejects(()=>save('test-link-A',input()),/bloqueada/);assert.equal(state.writes.length,0);});
test('link revogado bloqueia escrita',async()=>{state.tables.supplier_quote_sessions[0].status='canceled';await assert.rejects(()=>save('test-link-A',input()),/revogado/);assert.equal(state.writes.length,0);});
test('cotação finalizada bloqueia resposta posterior',async()=>{state.tables.quotations[0].status='finished';await assert.rejects(()=>save('test-link-A',input()),/finalizada/);assert.equal(state.writes.length,0);});
test('rascunho salva e reabre apenas os dados da sessão',async()=>{
 const result=await save('test-link-A',input());assert.equal(result.status,'draft');
 const reopened=await get('test-link-A','pharmacy');
 assert.equal(reopened.response.status,'draft');assert.equal(reopened.responseItems[0].unitPrice,10);
 assert.equal(reopened.response.tenantId,'tenant-A');
});
test('envio final marca sessão e atualiza acompanhamento',async()=>{
 await save('test-link-A',input({status:'submitted'}));
 assert.equal(state.tables.supplier_quote_sessions[0].status,'submitted');
 assert.equal(state.tables.quotations[0].status,'analyzing');
 await assert.rejects(()=>save('test-link-A',input()),/bloqueada/);
});
test('item estrangeiro enviado no corpo é ignorado',async()=>{
 await save('test-link-A',input({rows:[{quotationItemId:'item-A',netPrice:'10,00'},{quotationItemId:'foreign-item',netPrice:'1,00'}]}));
 assert.equal(state.tables.supplier_quote_response_items.length,1);
 assert.equal(state.tables.supplier_quote_response_items[0].quotation_item_id,'item-A');
});


test('declaração sem estoque, mesmo sem preço, permanece registrada como zero', async () => {
 await save('test-link-A', input({status:'submitted', rows:[{quotationItemId:'item-A', hasStock:'nao'}]}));
 const stored=state.tables.supplier_quote_response_items[0];
 assert.equal(stored.has_stock,false);
 assert.equal(stored.available_quantity,0);
 assert.equal(stored.unit_price,null);
});

test('quantidade parcial informada limita estoque gravado sem alterar preço unitário', async () => {
 await save('test-link-A',input({status:'submitted', rows:[{quotationItemId:'item-A',netPrice:'10,00',hasStock:'sim',attendedQuantity:'20'}]}));
 const stored=state.tables.supplier_quote_response_items[0];
 assert.equal(stored.available_quantity,20);
 assert.equal(stored.unit_price,10);
 assert.equal(stored.total_price_available,200);
});

test('não permite quantidade parcial quando o comprador a proibiu', async () => {
 state.tables.quotation_items[0].allow_partial_supply=false;
 await assert.rejects(
  ()=>save('test-link-A',input({status:'submitted',rows:[{quotationItemId:'item-A',netPrice:'10,00',attendedQuantity:'20'}]})),
  /não permite entrega parcial/,
 );
 assert.equal(state.writes.length,0);
});

test('proíbe substituição por equivalente sem permissão do comprador', async () => {
 await assert.rejects(
  ()=>save('test-link-A',input({status:'submitted',rows:[{quotationItemId:'item-A',netPrice:'10,00',offeredProductName:'TESTE PRODUTO DIFERENTE'}]})),
  /não autorizou produto equivalente/,
 );
 assert.equal(state.writes.length,0);
});

test('permite equivalente explicitamente autorizado globalmente e pelo item', async () => {
 state.tables.quotations[0].allow_equivalent=true;
 state.tables.quotation_items[0].accept_equivalent=true;
 await save('test-link-A',input({status:'submitted',rows:[{quotationItemId:'item-A',netPrice:'10,00',offeredProductName:'TESTE ALTERNATIVO'}]}));
 assert.equal(state.tables.supplier_quote_response_items[0].offered_product_name,'TESTE ALTERNATIVO');
});

test('vincula nome exato de distribuidora apenas ao cadastro do tenant da cotação', async () => {
 state.tables.distributors=[
  {id:'dist-A',tenant_id:'tenant-A',nome:'DISTRIBUIDORA TESTE'},
  {id:'dist-B',tenant_id:'tenant-B',nome:'DISTRIBUIDORA TESTE'},
 ];
 await save('test-link-A',input({status:'submitted',seller:{billingCompany:'Distribuidora Teste'},rows:[{quotationItemId:'item-A',netPrice:'10,00'}]}));
 assert.equal(state.tables.supplier_quote_response_items[0].distributor_id,'dist-A');
});

test('não vincula distribuidora se houver nome ambíguo na mesma empresa', async () => {
 state.tables.distributors=[
  {id:'dist-A1',tenant_id:'tenant-A',nome:'DISTRIBUIDORA TESTE'},
  {id:'dist-A2',tenant_id:'tenant-A',nome:'DISTRIBUIDORA TESTE'},
 ];
 await save('test-link-A',input({status:'submitted',seller:{billingCompany:'DISTRIBUIDORA TESTE'},rows:[{quotationItemId:'item-A',netPrice:'10,00'}]}));
 assert.equal(state.tables.supplier_quote_response_items[0].distributor_id,null);
});

for (const scenario of ['ausente','outra farmácia','ambígua']) {
 test(`mínimo ativo recusa distribuidora ${scenario} antes de gravar a resposta`, async () => {
  state.tables.quotations[0].consider_minimum_order=true;
  state.tables.distributors=scenario==='ambígua'
   ? [{id:'d1',tenant_id:'tenant-A',nome:'TESTE'},{id:'d2',tenant_id:'tenant-A',nome:'TESTE'}]
   : [{id:'foreign',tenant_id:'tenant-B',nome:'TESTE'}];
  await assert.rejects(()=>save('test-link-A',input({status:'submitted',
   seller:{billingCompany:scenario==='ausente'?'':'TESTE'}})),/distribuidora.*cadastrada/i);
  assert.equal(state.writes.length,0);
  assert.equal(state.tables.supplier_quote_sessions[0].status,'opened');
 });
}

test('mínimo ativo aceita distribuidora única da própria farmácia', async () => {
 state.tables.quotations[0].consider_minimum_order=true;
 state.tables.distributors=[{id:'d1',tenant_id:'tenant-A',nome:'TESTE ÁGUA'}];
 await save('test-link-A',input({status:'submitted',seller:{billingCompany:' teste agua '}}));
 assert.equal(state.tables.supplier_quote_response_items[0].distributor_id,'d1');
 assert.equal(state.tables.supplier_quote_sessions[0].status,'submitted');
});

test('mínimo ativo preserva rascunho e resposta somente sem estoque sem distribuidora', async () => {
 state.tables.quotations[0].consider_minimum_order=true;
 await save('test-link-A',input());
 await save('test-link-A',input({status:'submitted',rows:[{quotationItemId:'item-A',hasStock:'nao'}]}));
 assert.equal(state.tables.supplier_quote_response_items[0].has_stock,false);
});
