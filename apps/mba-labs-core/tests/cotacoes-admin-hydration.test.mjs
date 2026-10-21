import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import test from 'node:test';

const file=readFileSync(new URL('../src/app/layout.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('layout.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let script;
for(const statement of ast.statements){
 if(!ts.isVariableStatement(statement))continue;
 for(const declaration of statement.declarationList.declarations)
  if(declaration.name.getText(ast)==='encodingFixScript')script=declaration.initializer.text;
}
assert.ok(script);
function run(pathname,text){
 const textNode={nodeType:3,nodeValue:text};
 const body={nodeType:1,hasAttribute:()=>false,childNodes:[textNode]};
 runInNewContext(script,{
  window:{location:{pathname}},document:{body,readyState:'complete'},
  Node:{TEXT_NODE:3,ELEMENT_NODE:1},TextDecoder,Uint8Array,
  MutationObserver:class{observe(){}},
 });
 return textNode.nodeValue;
}

test('admin preserva títulos React antes da hidratação',()=>{
 for(const route of ['/cotacoes/gestao','/cotacoes/gestao/relatorios','/cotacoes/gestao/farmacias'])
  assert.equal(run(route,'MBA Cotações · relatorios'),'MBA Cotações · relatorios');
});

test('corretor global mantém o comportamento anterior no cliente e outros módulos',()=>{
 for(const route of ['/cotacoes','/cotacoes/produtos','/cotacoes/cotacoes-farmacia','/login','/elshaday'])
  assert.equal(run(route,'Relatorios e Nao'),'Relatórios e Não');
});
