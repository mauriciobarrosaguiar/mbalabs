import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {NextRequest} from 'next/server.js';
import {state} from './helpers/dronegestor-planning-fixture.mjs';
const fixture=new URL('./helpers/dronegestor-planning-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){if(['@/lib/core-data','@mba-labs/shared/supabase/server'].includes(s))return {url:fixture,shortCircuit:true};if(s.startsWith('@/lib/'))return {url:new URL('../src/lib/'+s.slice(6)+'.ts',import.meta.url).href,shortCircuit:true};if(s==='next/server')return n('next/server.js',c);return n(s,c);}});
const {GET,PUT}=await import('../src/app/api/dronegestor/state/route.ts');hook.deregister();
const req=(body)=>new NextRequest('https://localhost/api/dronegestor/state',body?{method:'PUT',body:JSON.stringify(body)}:undefined);
beforeEach(()=>Object.assign(state,{session:{user:{id:'auth'},profile:{id:'pedro',tipo:'usuario',status:'ativo',empresa_id:'A'},permissoes:[{appSlug:'dronegestor',perfil:'piloto'}],appsLiberados:[{slug:'dronegestor',canAccess:true}]},factories:0,writes:0,queries:[],audit:[],race:false,rows:[{id:'state-1',empresa_id:'B',usuario_id:'pedro',app_slug:'dronegestor',acao:'estado_campo_v2',detalhes:{revision:99,state:{secret:'foreign'}}},{id:'state-2',empresa_id:'A',usuario_id:'pedro',app_slug:'dronegestor',acao:'estado_campo_v2',detalhes:{revision:2,state:{mission:{}}}}]}));
test('same user cannot hydrate previous company state; valid revision updates only own company',async()=>{
 const result=await (await GET(req())).json();assert.equal(result.revision,2);assert.equal(result.state.secret,undefined);
 assert.equal((await PUT(req({baseRevision:2,state:{mission:{},progressHa:0}}))).status,200);assert.equal(state.rows[0].detalhes.revision,99);assert.equal(state.rows[1].detalhes.revision,3);
});
test('concurrent mutation and stale revision do not overwrite state',async()=>{
 assert.equal((await PUT(req({baseRevision:1,state:{mission:{}}}))).status,409);
 state.race=true;assert.equal((await PUT(req({baseRevision:2,state:{mission:{}}}))).status,409);assert.equal(state.writes,0);assert.equal(state.rows[1].detalhes.revision,2);
});
