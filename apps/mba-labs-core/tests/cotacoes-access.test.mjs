import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach } from 'node:test';
import { state } from './helpers/cotacoes-access-fixture.mjs';
const fixture = new URL('./helpers/cotacoes-access-fixture.mjs', import.meta.url).href;
const hooks = registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url:'data:text/javascript,export {}',shortCircuit:true };
  if (['@/modules/cotacoes/lib/auth/session','@/modules/cotacoes/lib/supabase/server'].includes(specifier))
    return {url:fixture,shortCircuit:true};
  if (specifier === '@/modules/cotacoes/lib/quotation-status')
    return {url:new URL('../src/modules/cotacoes/lib/quotation-status.ts',import.meta.url).href,shortCircuit:true};
  return nextResolve(specifier,context);
}});
const { ensureCreateQuotationAccess:create, ensureQuotationAccess:read } =
  await import('../src/modules/cotacoes/lib/auth/quotation-access.ts');
hooks.deregister();
const auth = extra => ({user:{id:'test-user'},profile:{id:'test-profile',role:'COMPRADOR'},
  isAuthenticated:true,isActive:true,isSuperAdmin:false,
  tenantAccess:{tenantId:'test-tenant-A',tenantType:'pharmacy',tenantStatus:'ativo',status:'ativo',role:'COMPRADOR'}, ...extra});
beforeEach(() => {state.row={id:'test-quotation',tenant_id:'test-tenant-A',module_type:'pharmacy',status:'open'};
 state.config=true;state.error=null;state.reads=0;});

test('comprador ativo cria apenas na empresa da sessão',()=>{
  assert.deepEqual(create(auth(),'pharmacy','test-tenant-B'),{ok:true,tenantId:'test-tenant-A'});
});
test('empresa A não lê cotação da empresa B nem recebe seus dados',async()=>{
  state.row.tenant_id='test-tenant-B';const result=await read(auth(),'test-quotation');
  assert.equal(result.ok,false);assert.equal(result.status,403);assert.equal(result.quotation,undefined);
});
test('master não cria cotação',()=>assert.equal(create(auth({isSuperAdmin:true}),'pharmacy').status,403));
test('master não opera cotação nem consulta banco',async()=>{
  assert.equal((await read(auth({isSuperAdmin:true}),'test-quotation')).status,403);
  assert.equal(state.reads,0);
});
test('sessão ausente é recusada',async()=>{
  const context=auth({isAuthenticated:false,user:null});
  assert.equal(create(context,'pharmacy').status,401);assert.equal((await read(context,'test')).status,401);
});
test('usuário inativo é recusado',()=>assert.equal(create(auth({isActive:false}),'pharmacy').status,401));
test('sem vínculo não cria cotação',()=>assert.equal(create(auth({tenantAccess:null}),'pharmacy').status,403));
test('módulo não contratado não cria cotação',()=>assert.equal(create(auth(),'bidding').status,403));
test('cotação inexistente retorna 404',async()=>{state.row=null;assert.equal((await read(auth(),'test')).status,404);});
test('falha de banco não vira autorização',async()=>{state.error=Error('test-db-failure');await assert.rejects(()=>read(auth(),'test'));});
test('farmácia suspensa não cria nem acessa cotação',async()=>{
  const context=auth();context.tenantAccess.tenantStatus='suspenso';
  assert.equal(create(context,'pharmacy').status,403);assert.equal((await read(context,'test')).status,403);
});
test('vínculo inativo não cria nem acessa cotação',async()=>{
  const context=auth();context.tenantAccess.status='inativo';
  assert.equal(create(context,'pharmacy').status,403);assert.equal((await read(context,'test')).status,403);
});
test('representante externo não cria cotação de comprador',()=>{
  const context=auth({profile:{id:'test-profile',role:'VENDEDOR_EXTERNO'}});
  assert.equal(create(context,'pharmacy').status,403);
});
test('perfil financeiro não cria cotação',()=>{
  const context=auth({profile:{id:'test-profile',role:'FINANCEIRO'}});
  assert.equal(create(context,'pharmacy').status,403);
});
test('cotação excluída por data não pode ser operada',async()=>{
  state.row.deleted_at='2026-10-17T10:00:00Z';assert.equal((await read(auth(),'test')).status,404);
});
test('cotação com status excluída não pode ser operada',async()=>{
  state.row.status='excluida';assert.equal((await read(auth(),'test')).status,404);
});
test('financeiro pode consultar mas não gerenciar cotação',async()=>{
 const context=auth({profile:{id:'test-profile',role:'FINANCEIRO'}});
 assert.equal((await read(context,'test')).ok,true);
 assert.equal((await read(context,'test',undefined,'manage')).status,403);
});
test('conferente pode consultar mas não gerenciar cotação',async()=>{
 const context=auth({profile:{id:'test-profile',role:'CONFERENTE'}});
 assert.equal((await read(context,'test')).ok,true);
 assert.equal((await read(context,'test',undefined,'manage')).status,403);
});
test('comprador e administrador ativos podem gerenciar sua cotação',async()=>{
 for(const role of ['COMPRADOR','ADMIN_EMPRESA']) {
  assert.equal((await read(auth({profile:{id:'test-profile',role}}),'test',undefined,'manage')).ok,true);
 }
});
