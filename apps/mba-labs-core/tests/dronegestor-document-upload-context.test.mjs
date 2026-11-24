import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function harness(){
 const source=readFileSync(new URL('../src/app/apps/dronegestor/documentos/AgroDocDocuments.tsx',import.meta.url),'utf8');
 const cut=source.slice(0,source.search(/^  return \($/m))+'  return {changeOrder,cancelUpload,send};\n}';
 const states=['os-A',[],'',false,'',0,null,true,'outro',{name:'TEST-ONLY.pdf',size:10},false,null,false,0,''];
 const refs=[{current:{value:'TEST-ONLY.pdf'}},{current:'os-A'},{current:false}];let index=0,refIndex=0,calls=0;
 let release;const blocked=new Promise(resolve=>{release=resolve;});
 const hooks={useState:()=>{const slot=index++;return[states[slot],v=>{states[slot]=typeof v==='function'?v(states[slot]):v;}];},useRef:()=>refs[refIndex++],useEffect:()=>{}};
 const resolve=s=>s==='react'?hooks:s==='next/navigation'?{useSearchParams:()=>new URLSearchParams()}:s==='../AgroDocUi'?{useAgroData:()=>({data:{items:[{entityId:'os-A',data:{status:'preparacao'}},{entityId:'os-B',data:{status:'preparacao'}}]}})}:{};
 const compiled={exports:{}};
 const code=ts.transpileModule(cut,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module','fetch',code)(resolve,compiled.exports,compiled,async()=>{calls++;await blocked;return{ok:false};});
 return{states,refs,get calls(){return calls;},release,render(){index=0;refIndex=0;return compiled.exports.AgroDocDocuments();}};
}
test('pending file blocks OS switch without discarding the selected file',()=>{
 const h=harness();h.render().changeOrder('os-B');
 assert.equal(h.states[0],'os-A');assert.equal(h.states[9].name,'TEST-ONLY.pdf');assert.match(h.states[2],/cancele.*antes de trocar de OS/);assert.equal(h.calls,0);
});
test('cancel clears file and input before switching to another OS',()=>{
 const h=harness();h.render().cancelUpload();assert.equal(h.states[9],null);assert.equal(h.refs[0].current.value,'');assert.equal(h.refs[1].current,'');assert.equal(h.states[7],false);
 h.render().changeOrder('os-B');assert.equal(h.states[0],'os-B');assert.equal(h.calls,0);
});
test('query-driven OS change cannot send a file selected for another OS',async()=>{
 const h=harness();h.states[0]='os-B';await h.render().send();assert.equal(h.calls,0);assert.equal(h.states[9],null);assert.match(h.states[2],/A OS mudou/);
});
test('in-flight upload blocks duplicate triggering and OS changes before React rerenders',async()=>{
 const h=harness(),actions=h.render();const first=actions.send();await actions.send();actions.changeOrder('os-B');
 assert.equal(h.calls,1);assert.equal(h.states[0],'os-A');h.release();await first;assert.equal(h.refs[2].current,false);
});

test('document API derives OS number from authorized persisted data, never form metadata',()=>{
 const source=readFileSync(new URL('../src/app/api/dronegestor/documentos/route.ts',import.meta.url),'utf8');
 const post=source.slice(source.indexOf('export async function POST'));
 assert.ok(post.length>500);
 assert.doesNotMatch(post,/form\.get\("ordemServicoNumero"\)/);
 assert.match(post,/const authorizedOs = await requireDroneOsWriteAccess\(admin, current, osId\)/);
 assert.match(post,/const osNumero = text\(authorizedOs\.data\.numero, 120\)/);
 assert.match(post,/ordemServicoNumero: osNumero/);
});


test('document pending shortcut retains selected OS and field return context and opens checklist',()=>{
 const source=readFileSync(new URL('../src/app/apps/dronegestor/documentos/AgroDocDocuments.tsx',import.meta.url),'utf8');
 const expression=source.match(/href=\{(`\$\{ROOT\}\/documentos\?\$\{new URLSearchParams\([\s\S]*?#agro-document-checklist`)\}/)?.[1];
 assert.ok(expression,'shortcut must carry document OS context');
 const href=new Function('ROOT','os','searchParams','return '+expression);
 const result=new URL(href('/apps/dronegestor','OS-ISOLADA',new URLSearchParams('returnTo=campo')),'https://example.invalid');
 assert.equal(result.searchParams.get('osId'),'OS-ISOLADA');
 assert.equal(result.searchParams.get('returnTo'),'campo');
 assert.equal(result.searchParams.get('checklist'),'1');
 assert.equal(result.hash,'#agro-document-checklist');
 assert.match(source,/<details id="agro-document-checklist" open=\{searchParams.get\("checklist"\)==="1"\}/);
});
