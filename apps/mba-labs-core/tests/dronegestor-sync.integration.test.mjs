import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the real client synchronizer with controllable storage and network.
// The private push function is exported only in this in-memory test module.
function harness() {
 const memory=new Map([['dronegestor:deviceOwner:v1','empresa-A:piloto-1'],['dronegestor:mission:v2',JSON.stringify({area:10})],['dronegestor:syncDirty:v4','1']]);
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
 let resolveResponse;
 const network=new Promise(resolve=>{resolveResponse=resolve;});
 const compile=(source,require)=>{const module={exports:{}};runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,localStorage:storage,fetch:()=>network,window:{dispatchEvent(){}},CustomEvent,Date,JSON,Number,Error});return module.exports;};
 const guard=compile(readFileSync(new URL('../src/lib/dronegestor-sync-guard.ts',import.meta.url),'utf8'),()=>({}));
 const source=readFileSync(new URL('../src/app/apps/dronegestor/campo/DronePersistenceSync.tsx',import.meta.url),'utf8')+'\nexport { pushState };';
 const client=compile(source,name=>name==='@/lib/dronegestor-sync-guard'?guard:{});
 return {memory,storage,push:client.pushState,respond:(status=200,body={revision:2})=>resolveResponse({status,ok:status>=200&&status<300,json:async()=>body})};
}
test('upload em voo não confirma edição posterior como sincronizada',async()=>{
 const h=harness(),pending=h.push(1);
 h.storage.setItem('dronegestor:mission:v2',JSON.stringify({area:12}));h.respond();await pending;
 assert.equal(h.memory.get('dronegestor:syncDirty:v4'),'1');
 assert.equal(h.memory.get('dronegestor:syncRevision:v4'),'2');
 assert.equal(JSON.parse(h.memory.get('dronegestor:mission:v2')).area,12);
});
test('resposta atrasada após troca de conta não altera estado da nova conta',async()=>{
 const h=harness(),pending=h.push(1);
 h.storage.setItem('dronegestor:deviceOwner:v1','empresa-B:piloto-2');h.respond();
 await assert.rejects(pending,/sessão mudou/);
 assert.equal(h.memory.has('dronegestor:syncRevision:v4'),false);
 assert.equal(h.memory.get('dronegestor:syncDirty:v4'),'1');
});
test('conflito da conta anterior também é descartado',async()=>{
 const h=harness(),pending=h.push(1);
 h.storage.setItem('dronegestor:deviceOwner:v1','empresa-B:piloto-2');h.respond(409,{revision:9,state:{mission:{area:99}}});
 await assert.rejects(pending,/sessão mudou/);
 assert.equal(h.memory.has('dronegestor:syncConflict:v4'),false);
});
test('acknowledgement do snapshot inalterado limpa pendência',async()=>{
 const h=harness(),pending=h.push(1);h.respond();await pending;
 assert.equal(h.memory.get('dronegestor:syncDirty:v4'),'0');
});
