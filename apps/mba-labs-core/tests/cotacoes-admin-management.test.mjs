import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import test,{beforeEach} from 'node:test';
import {state,reset} from './helpers/cotacoes-admin-report-fixture.mjs';

const fixture=new URL('./helpers/cotacoes-admin-report-fixture.mjs',import.meta.url).href;
const hooks=registerHooks({resolve(spec,context,next){
 if(spec==='next/server'||spec.startsWith('@/modules/cotacoes/'))
  return {url:fixture,shortCircuit:true};
 return next(spec,context);
}});
const {DELETE}=await import('../src/app/api/cotacoes/produtos-importar/route.ts');
const {GET}=await import('../src/app/api/cotacoes/admin/relatorios/route.ts');
hooks.deregister();

const req=(body)=>({json:async()=>body});
const report=(suffix='')=>({nextUrl:new URL('https://mba.invalid/api/cotacoes/admin/relatorios'+suffix)});
beforeEach(reset);

test('usuário de farmácia não pode apagar catálogo central nem consultar relatórios globais',async()=>{
 state.admin=false;
 const del=await DELETE(req({all:true,confirmation:'EXCLUIR CATÁLOGO CENTRAL'}));
 const rows=await GET(report());
 assert.equal(del.status,403);assert.equal(rows.status,403);
 assert.equal(state.tables.cot_product_catalog.length,2);
 assert.equal(state.writes.length,0);
});

test('exclusão selecionada atinge somente catálogo mestre, preserva dados de cliente',async()=>{
 const original=structuredClone(state.tables.products);
 const del=await DELETE(req({ids:['11111111-1111-4111-8111-111111111111']}));
 assert.equal(del.status,200);
 assert.equal(state.tables.cot_product_catalog.length,1);
 assert.deepEqual(state.tables.products,original);
 assert.deepEqual(state.writes,['cot_product_catalog']);
});

test('exclusão total requer confirmação exata e preserva produtos privados da farmácia',async()=>{
 assert.equal((await DELETE(req({all:true,confirmation:'sim'}))).status,400);
 assert.equal(state.tables.cot_product_catalog.length,2);
 const result=await DELETE(req({all:true,confirmation:'EXCLUIR CATÁLOGO CENTRAL'}));
 assert.equal(result.status,200);
 assert.equal(state.tables.cot_product_catalog.length,0);
 assert.equal(state.tables.products.length,1);
});

test('relatório admin inclui cotação, vendedor, distribuidora e oferta registrada',async()=>{
 const r=await GET(report());
 assert.equal(r.status,200);
 assert.equal(r.body.quotations,1);
 assert.equal(r.body.total,1);
 assert.equal(r.body.rows[0].empresa,'FARMACIA A');
 assert.equal(r.body.rows[0].representante,'Vendedor A');
 assert.equal(r.body.rows[0].distribuidora,'Distribuidora A');
 assert.equal(r.body.rows[0].precoUnitario,12.3);
});

test('relatório exportado filtra empresa e preserva identidade da cotação',async()=>{
 const empty=await GET(report('?empresa=tenant-b'));
 assert.equal(empty.body.total,0);
 const selected=await GET(report('?empresa=tenant-a&formato=csv'));
 assert.equal(selected.status,200);
 assert.ok(selected.body.startsWith('\uFEFF'));
 assert.match(selected.body,/FARMACIA A/);
 assert.match(selected.body,/Vendedor A/);
 assert.match(selected.body,/PRODUTO A/);
 assert.doesNotMatch(selected.body,/FARMACIA B/);
});

test('migração protege limite por tenant e mês contra criação concorrente',()=>{
 const sql=readFileSync(new URL('../../../supabase/migrations/20261020224500_cotacoes_enforce_plan_quotation_limit.sql',import.meta.url),'utf8');
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/BEFORE INSERT ON public.quotations/);
 assert.match(sql,/max_quotations_month/);
 assert.match(sql,/America\/Sao_Paulo/);
 assert.match(sql,/v_used >= v_limit/);
});

test('pendentes e itens sem oferta preservam produto e quantidade solicitados',async()=>{
 state.tables.supplier_quote_responses=[];
 state.tables.supplier_quote_response_items=[];
 state.tables.supplier_quote_sessions[0].status='pending';
 const result=await GET(report());
 assert.equal(result.body.rows[0].produtoSolicitado,'PRODUTO A');
 assert.equal(result.body.rows[0].quantidadeSolicitada,20);
 assert.equal(result.body.rows[0].precoUnitario,'');
 assert.equal(result.body.rows[0].situacaoResposta,'pending');
});

test('CSV respeita filtros de representante, distribuidora e período brasileiro',async()=>{
 for(const query of ['?representante=outro','?distribuidora=inexistente','?inicio=2026-10-21','?fim=2026-10-18']) {
  assert.equal((await GET(report(query))).body.total,0);
 }
 const response=await GET(report('?representante=supplier-a&distribuidora=dist-a&inicio=2026-10-19&fim=2026-10-19&formato=csv'));
 assert.match(response.body,/PRODUTO A/);
 assert.match(response.body,/Quantidade solicitada/);
 assert.match(response.body,/Resultado do item/);
 assert.equal((await GET(report('?inicio=2026-10-21&fim=2026-10-19'))).status,400);
});

test('respostas antigas permanecem sem transformar novo convite em respondido',async()=>{
 state.tables.supplier_quote_sessions.push({...state.tables.supplier_quote_sessions[0],id:'session-new',status:'pending',submitted_at:null});
 const result=await GET(report());
 assert.equal(result.body.total,2);
 assert.equal(result.body.rows.filter(r=>r.situacaoResposta==='pending').length,1);
 assert.equal(result.body.rows.filter(r=>r.situacaoResposta==='submitted').length,1);
});

test('referências inconsistentes não misturam dados de empresas',async()=>{
 state.tables.supplier_quote_responses[0].tenant_id='tenant-b';
 state.tables.supplier_quote_response_items[0].tenant_id='tenant-b';
 const result=await GET(report());
 assert.equal(result.body.rows[0].precoUnitario,'');
 assert.equal(result.body.rows[0].distribuidora,'');
});

test('filtro por distribuidora de outra empresa não inclui homônimos históricos',async()=>{
 state.tables.supplier_quote_response_items[0].distributor_id=null;
 state.tables.distributors.push({id:'dist-b',tenant_id:'tenant-b',nome:'Distribuidora A'});
 assert.equal((await GET(report('?distribuidora=dist-b'))).body.total,0);
 assert.equal((await GET(report('?distribuidora=dist-a'))).body.total,1);
});

test('CSV neutraliza fórmulas e preserva preço zero',async()=>{
 state.tables.quotations[0].name='=HYPERLINK("bad")';
 state.tables.supplier_quote_response_items[0].net_price=0;
 const result=await GET(report('?formato=csv'));
 assert.match(result.body,/'=HYPERLINK/);
 assert.equal((await GET(report())).body.rows[0].precoUnitario,0);
});
