import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('administração renderiza navegação interna sem links para /admin da MBA Labs',async()=>{
 const source=await fs.readFile(new URL('../src/app/apps/dronegestor/administracao/DroneSystemAdministration.tsx',import.meta.url),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const reactUrl=import.meta.resolve('react'),jsxUrl=import.meta.resolve('react/jsx-runtime');
 const linkModule='data:text/javascript;base64,'+Buffer.from(`import React from ${JSON.stringify(reactUrl)}; export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}`).toString('base64');
 code=code.replace(/from "react\/jsx-runtime"/g,`from ${JSON.stringify(jsxUrl)}`).replace(/from "react"/g,`from ${JSON.stringify(reactUrl)}`).replace(/from "next\/link"/g,`from ${JSON.stringify(linkModule)}`);
 const {DroneSystemAdministration}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const html=renderToStaticMarkup(React.createElement(DroneSystemAdministration));
 assert.match(html,/Administração do DroneGestor/);assert.match(html,/Cadastrar empresa no DroneGestor/);
 const links=[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);
 assert.ok(links.length>0);assert.ok(links.every(href=>href.startsWith('/apps/dronegestor')));
 assert.doesNotMatch(html,/href="\/admin\//);
});
