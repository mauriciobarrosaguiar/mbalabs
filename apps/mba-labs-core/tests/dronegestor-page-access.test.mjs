import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks,createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {pageSession} from './helpers/dronegestor-page-access-fixture.mjs';
import * as roles from '../src/lib/dronegestor-role.ts';
const fixture=new URL('./helpers/dronegestor-page-access-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(s,c,n){
 if(['@/lib/core-data','next/navigation'].includes(s))return{url:fixture,shortCircuit:true};
 if(s==='@/lib/dronegestor-role')return{url:new URL('../src/lib/dronegestor-role.ts',import.meta.url).href,shortCircuit:true};
 return n(s,c);
}});
const access=await import('../src/lib/dronegestor-page-access.ts');hook.deregister();
const require=createRequire(import.meta.url);
function loadPage(name){
 const source=readFileSync(new URL(`../src/app/apps/dronegestor/${name}/page.tsx`,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const compiled={exports:{}};
 const resolve=s=>s==='@/lib/dronegestor-page-access'?access:s==='@/lib/dronegestor-role'?roles:s==='react/jsx-runtime'?require(s):new Proxy({},{get:()=>function Child(){}});
 new Function('require','exports','module',code)(resolve,compiled.exports,compiled);
 return compiled.exports.default;
}
const pages=['cadastros','conferencia','pilotos','equipe','configuracoes','relatorio-mensal'];
function session(perfil,status='ativo'){return{tipo:'usuario',usuario:{status},isAdminMaster:false,permissoes:[{appSlug:'dronegestor',perfil,podeAcessar:true}]};}
for(const page of pages){
 test(`${page}: real page rejects pilot, applicator and viewer before rendering`,async()=>{
  const render=loadPage(page);
  for(const role of ['piloto','aplicador_caar','visualizador']){pageSession.current=session(role);await assert.rejects(render(),/REDIRECT:\/apps\/dronegestor\/gestao/);}
 });
 test(`${page}: manager, RT and company administrator retain access`,async()=>{
  const render=loadPage(page);
  for(const role of ['gestor_operacional','responsavel_tecnico','admin_empresa']){pageSession.current=session(role);assert.ok(await render());}
 });
}
test('management boundary rejects inactive and unauthenticated sessions',async()=>{
 pageSession.current=session('admin_empresa','bloqueado');await assert.rejects(access.requireDroneManagementPage('/test'),/REDIRECT/);
 pageSession.current=null;await assert.rejects(access.requireDroneManagementPage('/test'),/AUTH_REQUIRED/);
 assert.equal(pageSession.calls.at(-1).app,'dronegestor');
});

test('pilot dashboard flow links to own records instead of management review',async()=>{
 const React=require('react');const{renderToStaticMarkup}=require('react-dom/server');
 const source=readFileSync(new URL('../src/app/apps/dronegestor/AgroDocUi.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const compiled={exports:{}};
 const resolve=s=>s==='react'||s==='react/jsx-runtime'?require(s):s==='next/link'?{default:({href,children})=>React.createElement('a',{href},children)}:new Proxy({},{get:()=>function Icon(){return null;}});
 new Function('require','exports','module',code)(resolve,compiled.exports,compiled);
 const pilot=renderToStaticMarkup(React.createElement(compiled.exports.AgroDocFlow,{canManage:false}));
 assert.match(pilot,/href="\/apps\/dronegestor\/fichas"/);assert.doesNotMatch(pilot,/href="\/apps\/dronegestor\/conferencia"/);
 assert.match(pilot,/href="\/apps\/dronegestor\/documentos"/);assert.doesNotMatch(pilot,/href="\/apps\/dronegestor\/relatorio-mensal"/);
 const manager=renderToStaticMarkup(React.createElement(compiled.exports.AgroDocFlow,{canManage:true}));
 assert.match(manager,/href="\/apps\/dronegestor\/conferencia"/);
});
