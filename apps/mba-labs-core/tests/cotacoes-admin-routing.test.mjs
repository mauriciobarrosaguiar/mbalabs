import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import test from 'node:test';

const source=readFileSync(new URL('../src/app/cotacoes/gestao/[[...slug]]/page.tsx',import.meta.url),'utf8');
function fixture(allowed=true) {
 const calls=[];
 const module={exports:{}};
 const jsx=(component,props)=>({component,props});
 const stubs={
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'next/navigation':{notFound(){throw Error('404');},redirect(url){throw Error('redirect:'+url);}},
  '@/modules/cotacoes/components/layout/app-shell':{AppShell:'AppShell'},
  '@/modules/cotacoes/components/dashboard/pages':{AdminDashboardPage:'Dashboard',AdminSectionPage:'Section'},
  '@/modules/cotacoes/lib/auth/session':{requireSuperAdmin:async path=>{calls.push(path);if(!allowed)throw Error('403');return {profile:{role:'SUPER_ADMIN'}};}},
 };
 const code=transpileModule(source,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.ReactJSX}}).outputText;
 runInNewContext(code,{exports:module.exports,require:id=>{assert.ok(stubs[id],id);return stubs[id];},Set});
 return {render:module.exports.default,calls};
}

test('rota de relatórios chega à seção real e exige SUPER_ADMIN',async()=>{
 const f=fixture();
 const result=await f.render({params:Promise.resolve({slug:['relatorios']})});
 assert.equal(result.props.mode,'admin');
 assert.equal(result.props.children.props.section,'relatorios');
 assert.deepEqual(f.calls,['/cotacoes/gestao/relatorios']);
 await assert.rejects(()=>fixture(false).render({params:Promise.resolve({slug:['relatorios']})}),/403/);
});

test('todas as seções do menu resolvem e seções desconhecidas continuam 404',async()=>{
 for(const section of ['farmacias','representantes','distribuidoras','produtos','usuarios','planos','mensalidades','configuracoes','logs']){
  const f=fixture();
  assert.equal((await f.render({params:Promise.resolve({slug:[section]})})).props.children.props.section,section);
 }
 await assert.rejects(()=>fixture().render({params:Promise.resolve({slug:['inexistente']})}),/404/);
});
