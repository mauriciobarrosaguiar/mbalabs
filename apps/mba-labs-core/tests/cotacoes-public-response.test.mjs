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
