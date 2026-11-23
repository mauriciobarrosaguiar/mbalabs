import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {NextRequest} from 'next/server.js';
import {state,createSupabaseAdminClient} from './helpers/dronegestor-planning-fixture.mjs';
const fixture=new URL('./helpers/dronegestor-closed-os-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){
 if(['@/lib/core-data','@mba-labs/shared/supabase/server','@/lib/agrodoc-cloud'].includes(s))return{url:fixture,shortCircuit:true};
 if(s.startsWith('@/lib/'))return{url:new URL('../src/lib/'+s.slice(6)+'.ts',import.meta.url).href,shortCircuit:true};
 if(s==='next/server')return n('next/server.js',c);return n(s,c);
}});
const routes={};for(const name of ['documentos','mapa','mapa-geometria','sarpas','cloud/upload'])routes[name]=await import(`../src/app/api/dronegestor/${name}/route.ts`);
const {requireDroneOsAccess,requireDroneOsWriteAccess}=await import('../src/lib/dronegestor-os-access.ts');hook.deregister();
beforeEach(()=>Object.assign(state,{session:{user:{id:'auth'},profile:{id:'rt-A',tipo:'usuario',status:'ativo',empresa_id:'company-A'},permissoes:[{appSlug:'dronegestor',perfil:'responsavel_tecnico',podeAcessar:true}],appsLiberados:[{slug:'dronegestor',canAccess:true}]},factories:0,writes:0,queries:[],audit:[],externalCalls:0,rows:[{id:'row',acao:'ordem_servico',empresa_id:'company-A',usuario_id:'owner',app_slug:'dronegestor',detalhes:{entityId:'OS-QA',ativo:true,data:{status:'cancelada',pilotoResponsavelId:'pedro'}}}]}));
function request(name){
 const url='https://example.invalid/api/dronegestor/'+name;
 if(['documentos','mapa'].includes(name)){const form=new FormData();form.set('ordemServicoId','OS-QA');form.set('tipo','outro');return new NextRequest(url,{method:'POST',body:form});}
 const body=name==='sarpas'?{ordemServicoId:'OS-QA',status:'nao_solicitado'}:name==='mapa-geometria'?{ordemServicoId:'OS-QA',sourceFormat:'geojson',coordinates:[[-48,-10],[-48.001,-10],[-48.001,-10.001],[-48,-10]]}:{action:'start',osId:'OS-QA',category:'outro',name:'TEST-ONLY.pdf',mimeType:'application/pdf',size:10};
 return new NextRequest(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
}
for(const name of Object.keys(routes))for(const status of ['cancelada','concluida'])test(`${name}: ${status} rejects write before storage, database or cloud mutation`,async()=>{
 state.rows[0].detalhes.data.status=status;const response=await routes[name].POST(request(name));
 assert.equal(response.status,409,JSON.stringify(await response.clone().json()));
 assert.match((await response.json()).error,/somente consulta/);assert.equal(state.writes,0);assert.equal(state.audit.length,0);assert.equal(state.externalCalls,0);
});
for(const status of ['cancelada','concluida'])test(`cloud resumable session is not returned for ${status}`,async()=>{
 state.rows[0].detalhes.data.status=status;const response=await routes['cloud/upload'].GET(new NextRequest('https://example.invalid/api/dronegestor/cloud/upload?osId=OS-QA'));
 assert.equal(response.status,409);assert.equal(state.externalCalls,0);
});
test('read access to closed OS is preserved and preparation remains writable',async()=>{
 const context={userId:'rt-A',empresaId:'company-A',canManage:true},admin=createSupabaseAdminClient();
 assert.equal((await requireDroneOsAccess(admin,context,'OS-QA')).data.status,'cancelada');
 state.rows[0].detalhes.data.status='preparacao';assert.equal((await requireDroneOsWriteAccess(admin,context,'OS-QA')).data.status,'preparacao');
});

test('assigned pilot can consult cancellation but cannot write evidence',async()=>{
 const admin=createSupabaseAdminClient(),context={userId:'pedro',empresaId:'company-A',canManage:false};
 assert.equal((await requireDroneOsAccess(admin,context,'OS-QA')).data.status,'cancelada');
 await assert.rejects(requireDroneOsWriteAccess(admin,context,'OS-QA'),error=>error.status===409);
 assert.equal(state.writes,0);
});
test('write guard preserves other-pilot and cross-company denials before exposing OS status',async()=>{
 const admin=createSupabaseAdminClient();
 await assert.rejects(requireDroneOsWriteAccess(admin,{userId:'joao',empresaId:'company-A',canManage:false},'OS-QA'),error=>error.status===403);
 await assert.rejects(requireDroneOsWriteAccess(admin,{userId:'rt-B',empresaId:'company-B',canManage:true},'OS-QA'),error=>error.status===404);
 assert.equal(state.writes,0);assert.equal(state.audit.length,0);
});
