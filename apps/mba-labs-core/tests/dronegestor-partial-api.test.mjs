import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {NextRequest} from 'next/server.js';
import {state} from './helpers/dronegestor-planning-fixture.mjs';
const fixture=new URL('./helpers/dronegestor-planning-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){if(['@/lib/core-data','@mba-labs/shared/supabase/server'].includes(s))return {url:fixture,shortCircuit:true};if(s.startsWith('@/lib/'))return {url:new URL('../src/lib/'+s.slice(6)+'.ts',import.meta.url).href,shortCircuit:true};if(s==='next/server')return n('next/server.js',c);return n(s,c);}});
const {POST}=await import('../src/app/api/dronegestor/execucao-parcial/route.ts');hook.deregister();
const payload=()=>({osId:'os-1',requestId:'request-123',reason:'Chuva',justification:'Chuva no talhão',state:{mission:{ordemServicoId:'os-1',area:20},progressHa:12,startedAt:'2026-11-22T11:00:00Z',tankRecords:[{id:'load-1',at:'2026-11-22T11:10:00Z',areaHa:12,volumeL:120}]}});
const req=(p=payload())=>new NextRequest('https://localhost/api/dronegestor/execucao-parcial',{method:'POST',body:JSON.stringify(p),headers:{'content-type':'application/json'}});
beforeEach(()=>Object.assign(state,{session:{user:{id:'auth'},profile:{id:'pedro',tipo:'usuario',status:'ativo',empresa_id:'A'},permissoes:[{appSlug:'dronegestor',perfil:'piloto',podeAcessar:true}],appsLiberados:[{slug:'dronegestor',canAccess:true}]},factories:0,writes:0,queries:[],audit:[],race:false,rows:[{id:'os-row',app_slug:'dronegestor',acao:'ordem_servico',empresa_id:'A',usuario_id:'rt',detalhes:{entityId:'os-1',ativo:true,updatedAt:'v1',data:{status:'em_execucao',iniciadaEm:'2026-11-22T11:00:00Z',areaHa:20,pilotoResponsavelId:'pedro'}}},{app_slug:'dronegestor',acao:'piloto_operacional_v1',empresa_id:'A',detalhes:{usuarioId:'pedro',ativo:true,permissoes:{executarOs:true,editarParametros:true}}}]}));
test('stores 12/20 with 8 pending and atomic audit; retry does not duplicate',async()=>{
 const r=await POST(req());assert.equal(r.status,200);const data=state.rows[0].detalhes.data;
 assert.equal(data.status,'suspensa');assert.equal(data.execucaoParcialAtiva,true);assert.equal(data.execucoesParciais[0].areaRestanteHa,8);assert.equal(data.execucoesParciais[0].usuarioId,'pedro');
 assert.deepEqual(data.execucoesParciais[0].snapshot.tankRecords,payload().state.tankRecords);assert.equal(state.audit.length,0);
 const retry=await POST(req());assert.equal((await retry.json()).duplicate,true);assert.equal(state.writes,1);
});
test('session absent, expired access, inactive profile, other pilot and other company cannot write',async()=>{
 state.session.profile.id='joao';assert.equal((await POST(req())).status,403);
 state.session.profile.empresa_id='B';assert.equal((await POST(req())).status,404);
 state.session.appsLiberados=[];assert.equal((await POST(req())).status,403);
 state.session.profile.status='bloqueado';assert.equal((await POST(req())).status,403);
 state.session=null;assert.equal((await POST(req())).status,401);assert.equal(state.writes,0);
});
test('cannot fabricate a partial close on preparation, finished/cancelled OS or unrelated snapshot',async()=>{
 for(const status of ['em_preparacao','campo_concluido','concluida','cancelada']){state.rows[0].detalhes.data.status=status;assert.equal((await POST(req())).status,409);}
 state.rows[0].detalhes.data.status='em_execucao';const p=payload();p.state.mission.ordemServicoId='foreign';assert.equal((await POST(req(p))).status,400);assert.equal(state.writes,0);
});
test('concurrent mutation returns conflict without saving',async()=>{state.race=true;assert.equal((await POST(req())).status,409);assert.equal(state.writes,0);});
test('continuation keeps cumulative loads; removing initial load is rejected',async()=>{
 assert.equal((await POST(req())).status,200);state.rows[0].detalhes.data.execucaoParcialAtiva=false;state.rows[0].detalhes.data.status='em_execucao';
 const p=payload();p.requestId='request-456';p.state.progressHa=14;p.state.tankRecords=[{...p.state.tankRecords[0],areaHa:14}];assert.equal((await POST(req(p))).status,409);
 p.state.tankRecords=[...payload().state.tankRecords,{id:'load-2',at:'2026-11-22T12:00:00Z',areaHa:2,volumeL:20}];assert.equal((await POST(req(p))).status,200);assert.equal(state.rows[0].detalhes.data.execucoesParciais[1].areaRestanteHa,6);
});
