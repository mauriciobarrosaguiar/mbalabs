import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root=fileURLToPath(new URL("../src/app/apps/dronegestor/",import.meta.url));
const read=(file)=>readFileSync(path.join(root,file),"utf8");

test("all routes listed in the DroneGestor sidebar exist",()=>{
  const shell=read("DroneAppShell.tsx");
  const pages=shell.split("const pages = [")[1]?.split("];")[0];
  assert.ok(pages,"sidebar route registry not found");
  const paths=[...pages.matchAll(/\{\s*path:\s*"([^"]*)"/g)].map(x=>x[1]);
  assert.ok(paths.length>=18,"unexpectedly small menu registry");
  for(const route of paths){
    const file=path.join(root,route,"page.tsx");
    assert.ok(existsSync(file),`Menu route /apps/dronegestor/${route} must have a page.tsx`);
  }
});

test("role-aware bottom navigation and help route are explicit",()=>{
  const shell=read("DroneAppShell.tsx");
  assert.match(shell,/canManage \? \[/);
  assert.match(shell,/path: "campo", title: "Campo"/);
  assert.match(shell,/path: "conferencia", title: "Conferência"/);
  assert.match(shell,/href=\{\x60\$\{ROOT\}\/ajuda\x60\}/);
  assert.ok(existsSync(path.join(root,"ajuda","page.tsx")));
});

test("the field follows the planned phases without weakening preflight",()=>{
  const field=read("campo/DroneGestorAppV3.tsx");
  const match=field.match(/const flow: View\[\] = \[([^\]]+)\]/);
  assert.ok(match,"field view ordering not found");
  const values=[...match[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(values,["nova","controle","estrategia","seguranca","calibracao","checklist","calda","sarpas","execucao","relatorios"]);
  assert.match(field,/await patchOs\("em_execucao"\)/);
  assert.match(field,/if \(!canStart\) return flash/);
  assert.match(field,/if \(target === "calibracao" && !safetyReady\)/);
});

test("opening a suspended OS never starts it on the server",()=>{
  const manage=read("gestao/DroneGestaoClientV3.tsx");
  const opening=manage.split("async function openOrder(item:Item)")[1]?.split("async function submitCliente(")[0];
  assert.ok(opening);
  assert.match(opening,/if\(status==="aberta"\)/);
  assert.doesNotMatch(opening,/data:\{status:"em_execucao"\}/);
  assert.match(opening,/status==="suspensa"/);
  assert.match(opening,/dronegestor:operationId:v3/);
  assert.match(opening,/dronegestor:started:v3","false"/);
});

test("operation document and dossier links keep osId",()=>{
  const flow=read("campo/DroneSimpleFlowUX.tsx");
  assert.match(flow,/documentos\?osId=\$\{encodeURIComponent\(osId\)\}/);
  assert.match(flow,/pacote-operacao\?osId=\$\{encodeURIComponent\(osId\)\}/);
  const manager=read("gestao/DroneManagerOperationsPanel.tsx");
  assert.match(manager,/drone-os-\$\{item\.osId\}/);
  assert.doesNotMatch(manager,/localStorage\.setItem\("dronegestor:mission:v2"/);
  const documents=read("documentos/AgroDocDocuments.tsx");
  assert.match(documents,/gestao\?tab=os&osId=/);
  const registry=read("cadastros/AgroDocRegistry.tsx");
  assert.match(registry,/gestao\?tab=fazenda/);
  assert.match(registry,/gestao\?tab=cliente/);
});
