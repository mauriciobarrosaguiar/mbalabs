import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {state} from './helpers/dronegestor-company-fixture.mjs';
const fixture = new URL('./helpers/dronegestor-company-fixture.mjs',import.meta.url).href;
const hooks = registerHooks({resolve(s,c,n){
  if(['@/lib/core-data','@mba-labs/shared/supabase/server','@/lib/dronegestor-pilot-account'].includes(s))return {url:fixture,shortCircuit:true};
  if(s==='@/lib/dronegestor-company-access')return {url:new URL('../src/lib/dronegestor-company-access.ts',import.meta.url).href,shortCircuit:true};
  if(s==='@/lib/dronegestor-role')return {url:new URL('../src/lib/dronegestor-role.ts',import.meta.url).href,shortCircuit:true};
  if(s==='./dronegestor-role')return {url:new URL('../src/lib/dronegestor-role.ts',import.meta.url).href,shortCircuit:true};
  if(s==='next/server')return n('next/server.js',c);
  return n(s,c);
}});
const {GET,POST,PATCH} = await import('../src/app/api/dronegestor/empresa/usuarios/route.ts');
const pilotRoutes=await import('../src/app/api/dronegestor/pilotos/route.ts');hooks.deregister();
const session = (tipo='admin_empresa') => ({user:{id:'auth-admin'},profile:{id:'admin-A',tipo,status:'ativo',empresa_id:'company-A'},appsLiberados:[{slug:'dronegestor',canAccess:true}],permissoes:[]});
const body = {nome:'HOMOLOGAÇÃO funcionário',email:'employee@example.invalid',perfil:'piloto',senhaAcesso:'SenhaSomenteTeste123'};
const req = b => new Request('http://localhost/api/dronegestor/empresa/usuarios',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
beforeEach(()=>Object.assign(state,{session:session(),factories:0,queries:[],created:[],logs:[],rolledBack:0,company:{id:'company-A',nome:'Empresa HOMOLOGAÇÃO',status:'ativa'},contract:{id:'contract-A',status:'ativo',data_vencimento:null},permissions:[{usuario_id:'employee-1',perfil_app:'piloto',status:'ativo'}],users:[{id:'employee-1',nome:'HOMOLOGAÇÃO',email:'employee@example.invalid',status:'ativo'}],logError:null,updates:[],editUser:null,editPermission:null,pilotRows:[],updateErrorTable:null}));
test('sem sessão ou usuário inativo não chega ao cliente privilegiado',async()=>{
  state.session=null;assert.equal((await GET()).status,401);
  state.session=session();state.session.profile.status='bloqueado';assert.equal((await POST(req(body))).status,403);
  assert.equal(state.factories,0);
});
test('piloto, RT e gestor operacional não cadastram funcionários',async()=>{
  for(const role of ['piloto','responsavel_tecnico','gestor_operacional','visualizador']){state.session=session(role);assert.equal((await GET()).status,403);assert.equal((await POST(req(body))).status,403);}
  assert.equal(state.factories,0);
});
test('sem liberação do app ou sem empresa não cria conta',async()=>{
  state.session.appsLiberados=[];assert.equal((await POST(req(body))).status,403);
  state.session=session();state.session.profile.empresa_id=null;assert.equal((await POST(req(body))).status,409);assert.equal(state.created.length,0);
});
test('contrato ausente, vencido e empresa bloqueada negam criação',async()=>{
  state.contract=null;assert.equal((await POST(req(body))).status,403);
  state.contract={status:'ativo',data_vencimento:'2000-01-01'};assert.equal((await POST(req(body))).status,403);
  state.company.status='bloqueada';assert.equal((await POST(req(body))).status,403);assert.equal(state.created.length,0);
});
test('rejeita empresa, app ou privilégios globais injetados no corpo',async()=>{
  for(const key of ['empresa_id','empresaId','app_id','appId','tipo','tipo_global','isAdminMaster','permissoes'])assert.equal((await POST(req({...body,[key]:'company-B'}))).status,400);
  for(const perfil of ['super_admin','admin_master','admin_empresa','outro'])assert.equal((await POST(req({...body,perfil}))).status,400);
  assert.equal(state.created.length,0);
});
test('listagem consulta somente usuários e permissões da empresa e do app da sessão',async()=>{
  const response=await GET();assert.equal(response.status,200);const data=await response.json();assert.equal(data.items[0].perfil,'piloto');
  for(const table of ['core_usuarios','core_usuario_app_permissoes'])assert.ok(state.queries.find(q=>q.table===table).filters.some(([key,value])=>key==='empresa_id'&&value==='company-A'));
  assert.ok(state.queries.find(q=>q.table==='core_usuario_app_permissoes').filters.some(([key,value])=>key==='app_id'&&value==='app-drone'));
  assert.equal(JSON.stringify(data).includes('senha'),false);
});
test('admin da empresa cria piloto atribuível, com autoria e auditoria sem senha',async()=>{
  const response=await POST(req(body));assert.equal(response.status,201);
  assert.deepEqual(state.created[0].current,{empresaId:'company-A'});assert.equal(state.created[0].appId,'app-drone');assert.equal(state.created[0].role,'piloto');assert.equal(state.created[0].requireNewPermission,true);
  assert.equal(state.logs.length,2);assert.equal(state.logs[1].acao,'piloto_operacional_v1');assert.equal(state.logs[1].detalhes.usuarioId,'employee-1');assert.equal(state.logs[1].usuario_id,'admin-A');
  assert.equal(JSON.stringify(state.logs).includes(body.senhaAcesso),false);assert.equal(JSON.stringify(await response.json()).includes(body.senhaAcesso),false);
});
test('RT e gestor são perfis somente do app, sem cadastro operacional de piloto',async()=>{
  for(const perfil of ['responsavel_tecnico','gestor_operacional']){state.logs=[];assert.equal((await POST(req({...body,perfil}))).status,201);assert.equal(state.logs.length,1);assert.equal(state.logs[0].detalhes.perfil,perfil);}
});
test('falha ao salvar auditoria/piloto desfaz o acesso criado',async()=>{
  state.logError=Error('falha simulada');assert.equal((await POST(req(body))).status,500);assert.equal(state.rolledBack,1);
});

test('rotas antigas de pilotos também impedem RT e piloto de delegar acessos',async()=>{
  for(const role of ['responsavel_tecnico','piloto','gestor_operacional']){
    state.session=session(role);
    for(const action of ['POST','PATCH','DELETE'])assert.equal((await pilotRoutes[action](req(body))).status,403);
  }
  assert.equal(state.factories,0);
});

const employeeId='11111111-1111-4111-8111-111111111111';
function prepareEdit(role='piloto') {
 state.editUser={id:employeeId,nome:'HOMOLOGAÇÃO original',email:'employee@example.invalid',telefone:'123',status:'ativo',tipo:'usuario',tipo_global:'usuario'};
 state.editPermission={id:'permission-1',perfil_app:role,status:'ativo'};
 state.pilotRows=[{detalhes:{id:'pilot-1',usuarioId:employeeId,ativo:true,permissoes:{editarParametros:false},cpf:'',createdAt:'2026-01-01'}}];
 return {id:employeeId,nome:'HOMOLOGAÇÃO corrigido',telefone:'456',perfil:role};
}
test('edição exige administrador e rejeita senha, tenant, email e status',async()=>{
 const edit=prepareEdit();
 for(const role of ['piloto','responsavel_tecnico','gestor_operacional','visualizador']){state.session=session(role);assert.equal((await PATCH(req(edit))).status,403);}
 state.session=session();for(const key of ['empresaId','appId','email','senhaAcesso','status','tipo_global'])assert.equal((await PATCH(req({...edit,[key]:'injetado'}))).status,400);
 assert.equal(state.updates.length,0);
});
test('funcionário inexistente ou sem vínculo não pode ser editado',async()=>{
 const edit=prepareEdit();state.editUser=null;assert.equal((await PATCH(req(edit))).status,404);prepareEdit();state.editPermission=null;assert.equal((await PATCH(req(edit))).status,404);assert.equal(state.updates.length,0);
});
test('edição altera contato e papel somente na empresa e app autorizados',async()=>{
 const edit=prepareEdit();assert.equal((await PATCH(req(edit))).status,200);assert.deepEqual(state.updates[0].payload,{nome:edit.nome,telefone:edit.telefone});assert.deepEqual(state.updates[1].payload,{perfil_app:'piloto'});
 for(const q of state.updates)assert.ok(q.filters.some(([k,v])=>k==='empresa_id'&&v==='company-A'));
 assert.ok(state.updates[1].filters.some(([k,v])=>k==='app_id'&&v==='app-drone'));assert.equal(state.logs[1].detalhes.id,'pilot-1');assert.equal(state.logs[1].detalhes.nome,edit.nome);assert.equal(state.logs[1].detalhes.permissoes.editarParametros,false);
});
test('administrador permite corrigir contato mas não trocar papel',async()=>{
 const edit=prepareEdit('admin_empresa');assert.equal((await PATCH(req({...edit,perfil:'piloto'}))).status,403);assert.equal((await PATCH(req(edit))).status,200);prepareEdit();assert.equal((await PATCH(req({...edit,perfil:'super_admin'}))).status,400);
});
test('retirada de papel de piloto inativa cadastro operacional sem apagar histórico',async()=>{
 const edit=prepareEdit();assert.equal((await PATCH(req({...edit,perfil:'visualizador'}))).status,200);assert.equal(state.logs[1].detalhes.ativo,false);assert.equal(state.logs[1].detalhes.id,'pilot-1');
});
test('promoção a piloto cria registro conservador e não reativa conta bloqueada',async()=>{
 const edit=prepareEdit('visualizador');state.pilotRows=[];state.editUser.status='bloqueado';assert.equal((await PATCH(req({...edit,perfil:'piloto'}))).status,200);assert.equal(state.logs[1].detalhes.ativo,false);assert.equal(state.logs[1].detalhes.permissoes.registrarSarpas,false);
});
test('falha de auditoria restaura contato e papel anteriores',async()=>{
 const edit=prepareEdit();state.logError=Error('audit failed');assert.equal((await PATCH(req({...edit,perfil:'visualizador'}))).status,500);assert.deepEqual(state.updates[2].payload,{nome:'HOMOLOGAÇÃO original',telefone:'123'});assert.deepEqual(state.updates[3].payload,{perfil_app:'piloto'});
});
test('falha de mudança de papel restaura contato sem gravar auditoria',async()=>{
 const edit=prepareEdit();state.updateErrorTable='core_usuario_app_permissoes';assert.equal((await PATCH(req(edit))).status,500);assert.deepEqual(state.updates[2].payload,{nome:'HOMOLOGAÇÃO original',telefone:'123'});assert.equal(state.logs.length,0);
});
test('corrigir contato do administrador que também pilota preserva cadastro operacional ativo',async()=>{
 const edit=prepareEdit('admin_empresa');assert.equal((await PATCH(req(edit))).status,200);assert.equal(state.logs[1].detalhes.ativo,true);assert.equal(state.logs[1].detalhes.id,'pilot-1');
});
