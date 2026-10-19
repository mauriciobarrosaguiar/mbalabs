import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test,{beforeEach} from 'node:test';
import {state} from './helpers/cotacoes-crud-fixture.mjs';
const fixture=new URL('./helpers/cotacoes-crud-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){
 if(s==='next/server'||s.startsWith('@/'))return {url:fixture,shortCircuit:true};
 return n(s,c);
}});
const {POST}=await import('../src/app/api/cotacoes/produtos-importar/route.ts');
hook.deregister();
const req=()=>({json:async()=>({items:[]})});
beforeEach(()=>{state.writes=[];state.role='COMPRADOR';state.authenticated=true;});
test('importação sem sessão retorna 401, sem erro interno',async()=>{
 state.authenticated=false;const r=await POST(req());assert.equal(r.status,401);assert.equal(state.writes.length,0);
});
test('conferente recebe 403 ao importar, sem erro interno',async()=>{
 state.role='CONFERENTE';const r=await POST(req());assert.equal(r.status,403);assert.equal(state.writes.length,0);
});
test('comprador autorizado ainda recebe validação 400 para lote vazio',async()=>{
 const r=await POST(req());assert.equal(r.status,400);assert.equal(state.writes.length,0);
});
