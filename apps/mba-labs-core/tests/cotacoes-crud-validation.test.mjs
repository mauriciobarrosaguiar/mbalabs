import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test,{beforeEach} from 'node:test';
import {state} from './helpers/cotacoes-crud-fixture.mjs';
const fixture=new URL('./helpers/cotacoes-crud-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){
  if(s==='next/server'||s.startsWith('@/'))return {url:fixture,shortCircuit:true};
  return n(s,c);
}});
const {POST,PATCH}=await import('../src/app/api/cotacoes/crud/[entity]/route.ts');
hook.deregister();
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const data={nome:'TESTE_QA Produto',ean:'2001000000016',laboratorio:'TESTE_QA Lab',tenantId:tenant};
const req=d=>({json:async()=>d});
const params={params:Promise.resolve({entity:'products'})};
beforeEach(()=>{state.writes=[];state.labs=[];state.role='COMPRADOR';state.memberStatus='ativo';});
test('cadastro rejeita EAN curto sem criar produto nem laboratório',async()=>{
 const r=await POST(req({data:{...data,ean:'123'}}),params);assert.equal(r.status,400);assert.match(r.body.error,/EAN/);assert.equal(state.writes.length,0);
});
test('cadastro rejeita EAN com letras sem gravar laboratório',async()=>{
 const r=await POST(req({data:{...data,ean:'abc12345678901'}}),params);assert.equal(r.status,400);assert.equal(state.writes.length,0);
});
test('campos obrigatórios são validados antes de efeitos no laboratório',async()=>{
 const r=await POST(req({data:{...data,nome:''}}),params);assert.equal(r.status,400);assert.equal(state.writes.length,0);
});
test('EAN de 8 a 14 dígitos continua aceito com escopo da sessão',async()=>{
 for(const ean of ['12345678','2001000000016','12345678901234']){
  const r=await POST(req({data:{...data,ean,tenantId:'outra-empresa'}}),params);assert.equal(r.status,200);assert.equal(r.body.row.tenantId,tenant);
 }
});
test('financeiro e conferente não alteram cadastros',async()=>{
 for(const role of ['FINANCEIRO','CONFERENTE']){
  state.role=role;const r=await POST(req({data}),params);assert.equal(r.status,403);assert.equal(state.writes.length,0);
 }
});
test('vínculo inativo não altera cadastro mesmo com perfil ativo',async()=>{
 state.memberStatus='inativo';const r=await POST(req({data}),params);assert.equal(r.status,403);assert.equal(state.writes.length,0);
});
test('inativar produto próprio não exige reenviar EAN ou laboratório',async()=>{
 const r=await PATCH(req({id:'product-own',data:{status:'inativo'}}),params);assert.equal(r.status,200);assert.equal(r.body.row.status,'inativo');
});
