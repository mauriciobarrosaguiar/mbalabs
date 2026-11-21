import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {NextRequest} from 'next/server.js';
import {state} from './helpers/dronegestor-planning-fixture.mjs';
import {mergeDroneMissionPlan,validateDronePlan} from '../src/lib/dronegestor-planning.ts';
const fixture=new URL('./helpers/dronegestor-planning-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){if(['@/lib/core-data','@mba-labs/shared/supabase/server'].includes(s))return {url:fixture,shortCircuit:true};if(s.startsWith('@/lib/'))return {url:new URL('../src/lib/'+s.slice(6)+'.ts',import.meta.url).href,shortCircuit:true};if(s==='next/server')return n('next/server.js',c);return n(s,c);}});
const {GET,PATCH}=await import('../src/app/api/dronegestor/planejamento/route.ts');hook.deregister();
const equipment={nome:'HOMOLOGAÇÃO DRONE',marca:'TESTE',modelo:'FICTÍCIO',registroAnac:'HOMOLOGAÇÃO',tanqueL:20};
const input={osId:'os-1',expectedUpdatedAt:'version-1',tipoAtividade:'pulverizacao',equipamentoId:'drone-1',pontaModelo:'TESTE',volume:10,tanque:20,faixa:5,velocidadeKmh:18,alturaM:3,produtos:[{nome:'HOMOLOGAÇÃO produto',dose:100,unidade:'mL/ha'}]};
const req=(body)=>new NextRequest('https://localhost/api/dronegestor/planejamento?osId=os-1',body?{method:'PATCH',body:JSON.stringify(body),headers:{'content-type':'application/json'}}:undefined);
function row(acao,entityId,data,empresa_id='company-A'){return {id:entityId+'-row',acao,empresa_id,usuario_id:'owner',app_slug:'dronegestor',detalhes:{entityId,ativo:true,updatedAt:'version-1',data}};}
beforeEach(()=>Object.assign(state,{session:{user:{id:'auth'},profile:{id:'rt-A',tipo:'usuario',status:'ativo',empresa_id:'company-A'},permissoes:[{appSlug:'dronegestor',perfil:'responsavel_tecnico',podeAcessar:true}],appsLiberados:[{slug:'dronegestor',canAccess:true}]},factories:0,writes:0,queries:[],audit:[],race:false,auditError:false,rows:[row('ordem_servico','os-1',{numero:'HOMOLOGAÇÃO OS',status:'em_preparacao',areaHa:1.5,cultura:'Milho',alvo:'HOMOLOGAÇÃO',pilotoResponsavelId:'pedro',pilotoResponsavelNome:'Pedro'}),row('cadastro_equipamento','drone-1',equipment)]}));
test('piloto, aplicador e visualizador não planejam; sem sessão/inativo também não chega ao banco privilegiado',async()=>{
 for(const role of ['piloto','aplicador_caar','visualizador']){state.session.permissoes[0].perfil=role;assert.equal((await PATCH(req(input))).status,403);}
 state.session.profile.status='bloqueado';assert.equal((await GET(req())).status,403);state.session=null;assert.equal((await GET(req())).status,401);assert.equal(state.factories,0);
});
test('RT e gestor planejam sem assumir piloto ou iniciar OS',async()=>{
 const r=await PATCH(req(input));assert.equal(r.status,200);const os=state.rows[0].detalhes.data;assert.equal(os.status,'em_preparacao');assert.equal(os.pilotoResponsavelId,'pedro');assert.equal(os.missaoPlanejada.tanque,20);assert.equal(state.audit[0].acao,'missao_planejada_v1');
});
test('GET retorna somente equipamento da empresa e oculta inativo',async()=>{
 state.rows.push(row('cadastro_equipamento','foreign',equipment,'company-B'));const inactive=row('cadastro_equipamento','inactive',equipment);inactive.detalhes.ativo=false;state.rows.push(inactive);const r=await GET(req());assert.equal(r.status,200);assert.deepEqual((await r.json()).equipments.map(e=>e.id),['drone-1']);
});
test('outra empresa não pode ter OS ou drone alterado',async()=>{
 state.rows[0].empresa_id='company-B';assert.equal((await PATCH(req(input))).status,404);state.rows[0].empresa_id='company-A';state.rows[1].empresa_id='company-B';assert.equal((await PATCH(req(input))).status,400);assert.equal(state.writes,0);
});
test('execução, suspensão, campo concluído, encerramento e cancelamento impedem trocar planejamento',async()=>{
 for(const status of ['em_execucao','suspensa','campo_concluido','concluida','cancelada']){state.rows[0].detalhes.data.status=status;assert.equal((await PATCH(req(input))).status,409);}assert.equal(state.writes,0);
});
test('versão desatualizada e conflito na gravação não sobrescrevem OS',async()=>{
 assert.equal((await PATCH(req({...input,expectedUpdatedAt:'antiga'}))).status,409);state.race=true;assert.equal((await PATCH(req(input))).status,409);assert.equal(state.writes,0);
});
test('injeção de piloto, tenant, segurança ou status é recusada',async()=>{
 for(const key of ['empresaId','pilotoResponsavelId','status','riskAccepted','appId'])assert.equal((await PATCH(req({...input,[key]:'injetado'}))).status,400);assert.equal(state.writes,0);
});
test('validação recusa tanque além do cadastro, parâmetros inválidos e dose/unidade inválidas',async()=>{
 for(const bad of [{tanque:21},{volume:0},{faixa:-1},{produtos:[{nome:'produto',dose:1,unidade:'inválida'}]},{produtos:[]},{equipamentoId:''}])assert.equal((await PATCH(req({...input,...bad}))).status,400);assert.equal(state.writes,0);
});
test('falha de auditoria restaura planejamento anterior',async()=>{
 state.auditError=true;assert.equal((await PATCH(req(input))).status,500);assert.equal(state.rows[0].detalhes.updatedAt,'version-1');assert.equal(state.rows[0].detalhes.data.missaoPlanejada,undefined);
});
test('recebimento do plano só troca campos técnicos, preservando OS e cadastros',()=>{
 const base={ordemServicoId:'os-1',area:1.5,clienteId:'cliente-1',cultura:'Milho'};const next=mergeDroneMissionPlan(base,{missaoPlanejada:{...validateDronePlan(input,equipment),ordemServicoId:'outra',area:999,clienteId:'outro'},planejamentoAtualizadoEm:'plan-v1'});assert.equal(next.ordemServicoId,'os-1');assert.equal(next.area,1.5);assert.equal(next.clienteId,'cliente-1');assert.equal(next.volume,10);assert.equal(next.planejamentoAtualizadoEm,'plan-v1');
});
test('servidor recusa adulteração de dose e área de piloto sem editar parâmetros',async()=>{
 const {readonlyDronePlanIssue,dronePilotPlanningIssue}=await import('../src/lib/dronegestor-planning.ts');
 const plan=validateDronePlan(input,equipment),os={areaHa:1.5,cultura:'Milho',alvo:'HOMOLOGAÇÃO',missaoPlanejada:plan};
 const mission={...plan,area:1.5,cultura:'Milho',alvo:'HOMOLOGAÇÃO'};
 assert.equal(readonlyDronePlanIssue(os,mission),null);assert.ok(readonlyDronePlanIssue(os,{...mission,volume:99}));assert.ok(readonlyDronePlanIssue(os,{...mission,area:999}));assert.ok(readonlyDronePlanIssue(os,{...mission,produtos:[{nome:'HOMOLOGAÇÃO produto',dose:999,unidade:'mL/ha'}]}));
 const {createSupabaseAdminClient}=await import('./helpers/dronegestor-planning-fixture.mjs');const admin=createSupabaseAdminClient(),current={userId:'pedro',empresaId:'company-A',canManage:false};
 assert.ok(await dronePilotPlanningIssue(admin,current,os,mission));state.rows.push({acao:'piloto_operacional_v1',app_slug:'dronegestor',empresa_id:'company-A',detalhes:{usuarioId:'pedro',ativo:true,permissoes:{executarOs:true,editarParametros:false}}});
 assert.equal(await dronePilotPlanningIssue(admin,current,os,mission),null);assert.ok(await dronePilotPlanningIssue(admin,current,os,{...mission,volume:99}));
});

test('missão legada já iniciada preserva parâmetros do snapshot de servidor, sem confiar em novo plano do cliente',async()=>{
 const {dronePilotPlanningIssue}=await import('../src/lib/dronegestor-planning.ts');const {createSupabaseAdminClient}=await import('./helpers/dronegestor-planning-fixture.mjs');
 const mission={...validateDronePlan(input,equipment),ordemServicoId:'os-1',area:1.5,cultura:'Milho',alvo:'HOMOLOGAÇÃO'},os={status:'em_execucao',areaHa:1.5,cultura:'Milho',alvo:'HOMOLOGAÇÃO'};
 state.rows.push({acao:'piloto_operacional_v1',app_slug:'dronegestor',empresa_id:'company-A',detalhes:{usuarioId:'pedro',ativo:true,permissoes:{executarOs:true,editarParametros:false}}},{acao:'estado_campo_v2',app_slug:'dronegestor',empresa_id:'company-A',usuario_id:'pedro',detalhes:{state:{mission}}});
 const admin=createSupabaseAdminClient(),current={userId:'pedro',empresaId:'company-A',canManage:false};assert.equal(await dronePilotPlanningIssue(admin,current,os,mission),null);assert.ok(await dronePilotPlanningIssue(admin,current,os,{...mission,volume:999}));
});
