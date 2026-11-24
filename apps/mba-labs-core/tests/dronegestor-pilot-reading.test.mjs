import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {NextRequest} from 'next/server.js';
import {state} from './helpers/dronegestor-planning-fixture.mjs';
const fixture=new URL('./helpers/dronegestor-planning-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){
 if(['@/lib/core-data','@mba-labs/shared/supabase/server'].includes(s))return{url:fixture,shortCircuit:true};
 if(s.startsWith('@/lib/'))return{url:new URL('../src/lib/'+s.slice(6)+'.ts',import.meta.url).href,shortCircuit:true};
 if(s==='next/server')return n('next/server.js',c);return n(s,c);
}});
const{GET,POST}=await import('../src/app/api/dronegestor/cadastros/route.ts');hook.deregister();
const row=(acao,entityId,data,company='company-A')=>({id:'row-'+entityId,empresa_id:company,usuario_id:'manager',app_slug:'dronegestor',acao,detalhes:{entityId,ativo:true,data}});
beforeEach(()=>Object.assign(state,{session:{user:{id:'auth'},profile:{id:'pedro',nome:'Pedro TEST-ONLY',tipo:'usuario',status:'ativo',empresa_id:'company-A'},permissoes:[{appSlug:'dronegestor',perfil:'piloto',podeAcessar:true}],appsLiberados:[{slug:'dronegestor',canAccess:true}]},factories:0,writes:0,queries:[],audit:[],rows:[
 row('ordem_servico','os-pedro',{pilotoResponsavelId:'pedro',clienteId:'client-pedro',fazendaId:'farm-pedro',talhaoId:'plot-pedro',status:'em_preparacao'}),
 row('ordem_servico','os-joao',{pilotoResponsavelId:'joao',clienteId:'client-joao',fazendaId:'farm-joao',talhaoId:'plot-joao'}),
 ...['pedro','joao'].flatMap(name=>[row('cadastro_cliente','client-'+name,{nome:name,cpfCnpj:'PRIVATE',email:'PRIVATE'}),row('cadastro_fazenda','farm-'+name,{nome:name,clienteId:'client-'+name,municipio:'TEST',uf:'TO',endereco:'PRIVATE'}),row('cadastro_talhao','plot-'+name,{nome:name,fazendaId:'farm-'+name,areaHa:2})]),
 row('cadastro_cliente','foreign',{nome:'PRIVATE'},'company-B'),
 ]}));
const req=type=>new NextRequest(`https://localhost/api/dronegestor/cadastros?type=${type}`);
for(const [type,prefix] of [['cliente','client'],['fazenda','farm'],['talhao','plot']]){
 test(`pilot ${type} listing includes only relations of assigned OS and omits private fields`,async()=>{
  const response=await GET(req(type));assert.equal(response.status,200);const payload=await response.json();
  assert.deepEqual(payload.items.map(i=>i.entityId),[`${prefix}-pedro`]);assert.doesNotMatch(JSON.stringify(payload),/PRIVATE/);assert.equal(state.writes,0);
 });
}
test('pilot with no assigned OS receives empty related registries; manager keeps company registries',async()=>{
 state.rows[0].detalhes.data.pilotoResponsavelId='someone-else';assert.deepEqual((await(await GET(req('cliente'))).json()).items,[]);
 state.session.permissoes[0].perfil='gestor_operacional';assert.equal((await(await GET(req('cliente'))).json()).items.length,2);
 assert.equal(state.writes,0);
});
test('OS listing still includes only assigned OS and POST is rejected for pilot before write',async()=>{
 const result=await(await GET(req('os'))).json();assert.deepEqual(result.items.map(i=>i.entityId),['os-pedro']);
 const response=await POST(new NextRequest('https://localhost/api/dronegestor/cadastros',{method:'POST',body:JSON.stringify({type:'cliente',data:{nome:'TEST-ONLY'}})}));
 assert.equal(response.status,403);assert.equal(state.writes,0);
});
