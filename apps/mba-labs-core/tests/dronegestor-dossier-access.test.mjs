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
const{PATCH}=await import('../src/app/api/dronegestor/operacao-os/route.ts');hook.deregister();
beforeEach(()=>Object.assign(state,{session:{user:{id:'auth'},profile:{id:'rt-A',tipo:'usuario',status:'ativo',empresa_id:'company-A'},permissoes:[{appSlug:'dronegestor',perfil:'responsavel_tecnico',podeAcessar:true}],appsLiberados:[{slug:'dronegestor',canAccess:true}]},factories:0,writes:0,queries:[],audit:[],race:false,auditError:false,rows:[{id:'os-row',acao:'ordem_servico',empresa_id:'company-A',usuario_id:'owner',app_slug:'dronegestor',detalhes:{entityId:'os-1',ativo:true,updatedAt:'version-1',data:{numero:'TEST-ONLY',status:'cancelada',pilotoResponsavelId:'pedro'}}}]}));
const req=()=>new NextRequest('https://localhost/api/dronegestor/operacao-os',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({osId:'os-1',responsavelPropriedade:'TEST-ONLY',enderecoPropriedade:'TEST-ONLY'})});
test('cancelled and closed OS reject property edits without database writes',async()=>{
 for(const status of ['cancelada','concluida']){
  state.rows[0].detalhes.data.status=status;
  assert.equal((await PATCH(req())).status,409);
 }
 assert.equal(state.writes,0);
});
test('pilot and other company cannot edit the dossier by direct API',async()=>{
 state.session.permissoes[0].perfil='piloto';assert.equal((await PATCH(req())).status,403);
 state.session.permissoes[0].perfil='responsavel_tecnico';state.rows[0].empresa_id='company-B';
 assert.equal((await PATCH(req())).status,404);assert.equal(state.writes,0);
});
