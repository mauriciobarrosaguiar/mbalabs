import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test,{beforeEach} from 'node:test';
import {state} from './helpers/cotacoes-crud-fixture.mjs';

const fakeUrl=new URL('./helpers/cotacoes-crud-fixture.mjs',import.meta.url).href;
const hooks=registerHooks({resolve(spec,ctx,next){
  if (spec==='next/server'||spec.startsWith('@/')) return {url:fakeUrl,shortCircuit:true};
  return next(spec,ctx);
}});
const {DELETE,PATCH}=await import('../src/app/api/cotacoes/crud/[entity]/route.ts');
hooks.deregister();

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const params=entity=>({params:Promise.resolve({entity})});
const request=body=>({json:async()=>body});
const row=(n,tenant=owner)=>({id:id(n),tenant_id:tenant});
beforeEach(()=>{
  state.dbEnabled=true;state.db={products:[],suppliers:[],distributors:[]};
  state.deleted=[];state.role='COMPRADOR';state.memberStatus='ativo';
  state.authenticated=true;state.writes=[];state.labs=[];
});

test('exclui produto individual livre definitivamente, sem inativar',async()=>{
  state.db.products=[row(1)];
  const result=await DELETE(request({id:id(1)}),params('products'));
  assert.equal(result.status,200);
  assert.deepEqual(result.body.deletedIds,[id(1)]);
  assert.equal(state.db.products.length,0);
  assert.equal(state.deleted.length,1);
});

test('exclui 10 produtos livres, preservando produto usado em cotação',async()=>{
  state.db.products=Array.from({length:10},(_,i)=>row(i+1));
  state.db.quotation_items=[{product_id:id(2)}];
  const result=await DELETE(request({ids:state.db.products.map(x=>x.id)}),params('products'));
  assert.equal(result.status,200);
  assert.equal(result.body.deletedIds.length,10);
  assert.equal(result.body.blocked.length,0);
  assert.deepEqual(state.db.products.map(x=>x.id),[id(2)]);
  assert.equal(state.db.products[0].status,'inativo');
  assert.ok(state.db.products[0].deleted_at);
  assert.equal(state.db.quotation_items[0].product_id,id(2));
});

test('exclusão individual remove do catálogo mas mantém histórico de preços',async()=>{
  state.db.products=[row(1)];
  state.db.price_history=[{product_id:id(1)}];
  const result=await DELETE(request({id:id(1)}),params('products'));
  assert.equal(result.status,200);
  assert.deepEqual(result.body.deletedIds,[id(1)]);
  assert.equal(state.deleted.length,0);
  assert.equal(state.db.products.length,1);
  assert.ok(state.db.products[0].deleted_at);
  assert.equal(state.db.products[0].status,'inativo');
});

test('representante sem histórico é excluído, mas fornecedor com pedido permanece',async()=>{
  state.db.suppliers=[row(1),row(2)];
  state.db.purchase_orders=[{supplier_id:id(2)}];
  const result=await DELETE(request({ids:[id(1),id(2)]}),params('suppliers'));
  assert.equal(result.status,200);
  assert.deepEqual(new Set(result.body.deletedIds),new Set([id(1),id(2)]));
  assert.deepEqual(state.db.suppliers.map(x=>x.id),[id(2)]);
  assert.ok(state.db.suppliers[0].deleted_at);
  assert.equal(state.db.purchase_orders[0].supplier_id,id(2));
});

test('distribuidora vinculada à aprovação de pedido mínimo permanece',async()=>{
  state.db.distributors=[row(1),row(2)];
  state.db.cot_minimum_order_exceptions=[{distributor_id:id(2)}];
  const result=await DELETE(request({ids:[id(1),id(2)]}),params('distributors'));
  assert.equal(result.status,200);
  assert.deepEqual(new Set(result.body.deletedIds),new Set([id(1),id(2)]));
  assert.deepEqual(state.db.distributors.map(x=>x.id),[id(2)]);
  assert.ok(state.db.distributors[0].deleted_at);
  assert.equal(state.db.cot_minimum_order_exceptions[0].distributor_id,id(2));
});

test('não exclui nada se a seleção contiver cadastro de outra empresa',async()=>{
  state.db.products=[row(1),row(2,other)];
  const result=await DELETE(request({ids:[id(1),id(2)]}),params('products'));
  assert.equal(result.status,403);
  assert.equal(state.deleted.length,0);
});

test('não exclui registros globais sob sessão de farmácia',async()=>{
  state.db.products=[row(1,null)];
  const result=await DELETE(request({id:id(1)}),params('products'));
  assert.equal(result.status,403);
  assert.equal(state.deleted.length,0);
});

test('sem permissão ou vínculo inativo: exclusão negada',async()=>{
  state.db.suppliers=[row(1)];
  state.role='FINANCEIRO';
  assert.equal((await DELETE(request({id:id(1)}),params('suppliers'))).status,403);
  state.role='COMPRADOR';state.memberStatus='inativo';
  assert.equal((await DELETE(request({id:id(1)}),params('suppliers'))).status,403);
  assert.equal(state.deleted.length,0);
});

test('recusa identificadores inválidos ou lotes com mais de 100',async()=>{
  state.db.products=[row(1)];
  const bad=await DELETE(request({ids:[id(1),'fora-do-formato']}),params('products'));
  assert.equal(bad.status,400);
  const tooMany=await DELETE(request({ids:Array.from({length:101},(_,i)=>id(i+1))}),params('products'));
  assert.equal(tooMany.status,400);
  assert.equal(state.deleted.length,0);
});

test('100 registros por lote e 1000 produtos em 10 solicitações isoladas',async()=>{
  state.db.products=Array.from({length:1000},(_,i)=>row(i+1));
  for(let batch=0;batch<10;batch++){
    const ids=Array.from({length:100},(_,i)=>id(batch*100+i+1));
    const response=await DELETE(request({ids}),params('products'));
    assert.equal(response.status,200);
    assert.equal(response.body.deletedIds.length,100);
  }
  assert.equal(state.db.products.length,0);
  assert.equal(state.deleted.length,1000);
});

test('edição de produto da própria empresa permanece disponível',async()=>{
  state.db.products=[row(1)];
  const result=await PATCH(request({id:id(1),data:{status:'ativo'}}),params('products'));
  assert.equal(result.status,200);
  assert.equal(result.body.row.status,'ativo');
});

test('não é possível excluir novamente um cadastro já removido do catálogo',async()=>{
  state.db.products=[{...row(3),status:'inativo',deleted_at:'2026-10-20T12:00:00Z'}];
  const response=await DELETE(request({id:id(3)}),params('products'));
  assert.equal(response.status,404);
  assert.equal(state.deleted.length,0);
});

test('exclusão em massa mistura livres e históricos de três classes sem perder vínculos',async()=>{
  for(const [entity,history,col] of [
    ['products','quotation_items','product_id'],
    ['suppliers','supplier_quote_sessions','supplier_id'],
    ['distributors','purchase_order_items','distributor_id']
  ]) {
    state.db[entity]=[row(101),row(102),row(103)];
    state.db[history]=[{[col]:id(102)}];
    const response=await DELETE(request({ids:[id(101),id(102),id(103)]}),params(entity));
    assert.equal(response.status,200);
    assert.equal(response.body.deletedIds.length,3);
    assert.deepEqual(state.db[entity].map(x=>x.id),[id(102)]);
    assert.ok(state.db[entity][0].deleted_at);
    assert.equal(state.db[history][0][col],id(102));
  }
});
