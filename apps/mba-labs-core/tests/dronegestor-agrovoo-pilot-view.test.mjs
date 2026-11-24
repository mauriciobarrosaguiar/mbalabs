import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ownPilotOrders,pilotOrderState,sortPilotOrders,pilotOrderHref} from "../src/lib/agrovoo-pilot-view.ts";
const order=(id,pilot,status,dataPrevista)=>({entityId:id,data:{pilotoResponsavelId:pilot,status,dataPrevista}});
test("AgroVoo piloto: filtra estritamente por usuário e elimina duplicatas",()=>{
 const rows=[order("1","pedro","aberta"),order("2","outro","em_execucao"),order("1","pedro","aberta"),order("3","","aberta"),{entityId:"4"},order("","pedro","aberta")];
 assert.deepEqual(ownPilotOrders(rows,"pedro").map(x=>x.entityId),["1"]);
 assert.deepEqual(ownPilotOrders(rows,""),[]);
});
test("AgroVoo piloto: retomada e execução aparecem primeiro, sem marcar estados desconhecidos ativos",()=>{
 const rows=[order("a","p","concluida"),order("b","p","aberta"),order("c","p","em_execucao"),order("d","p","suspensa"),order("e","p","preparacao")];
 assert.deepEqual(sortPilotOrders(rows).map(x=>x.entityId),["c","d","e","b","a"]);
 assert.equal(pilotOrderState("campo_concluido").active,false);
 assert.equal(pilotOrderState(undefined).active,false);
 assert.equal(pilotOrderState("em_preparacao").active,true);
});
test("AgroVoo piloto: link apenas consulta OS no fluxo existente",()=>{
 assert.equal(pilotOrderHref("a&b"),"/apps/dronegestor/gestao?osId=a%26b");
 const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/"+p,import.meta.url),"utf8");
 const page=read("agrovoo/piloto/page.tsx");
 assert.match(page,/requireAppAccess\("dronegestor"/);
 assert.match(page,/if\(!isDroneGestorPilot\(role\)\)redirect/);
 const home=read("agrovoo/piloto/AgroVooPilotHome.tsx");
 assert.ok(home.includes("ownPilotOrders(source.data!.items,userId)"));
 assert.ok(home.includes("source.data.canManage===false"));
 assert.ok(!home.includes("localStorage"));
 assert.ok(!home.includes('method:"PATCH"'));
 assert.ok(!home.includes('method:"POST"'));
 const shell=read("DroneAppShell.tsx");
 assert.match(shell,/isPilot && !canManage && pilotShellPaths.some/);
 const routes=shell.match(/const pilotShellPaths = \[(.*?)\]/)?.[1];
 assert.ok(routes&&!routes.includes('"campo"')&&!routes.includes('"financeiro"'));
 const nav=read("agrovoo/AgroVooPilotShell.tsx");
 assert.ok(nav.includes('aria-label="Navegação do piloto AgroVoo"'));
 assert.ok(!nav.includes("/financeiro"));
 assert.ok(read("campo/page.tsx").includes("<DroneRegulatoryGuard"));
 assert.ok(read("campo/page.tsx").includes("<DronePersistenceSync"));
});

test("AgroVoo piloto: Minhas OS reutiliza abertura existente e revalida atribuição antes de gravar preparação",()=>{
 const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/"+p,import.meta.url),"utf8");
 const board=read("gestao/DroneGestaoClientV3.tsx");
 assert.ok(board.includes("if(pilotPreview&&!canManage)return <AgroVooPilotOrders"));
 assert.ok(board.includes("onOpen={item=>void openOrder(item)}"));
 assert.ok(board.includes("fresh.canManage===false"));
 assert.ok(board.includes("o.data?.pilotoResponsavelId===currentUserId"));
 assert.ok(board.indexOf("item=assigned;")<board.indexOf("droneDeviceSwitchIssue(localStorage,item.entityId)"));
 assert.ok(board.includes("data:{status:\"preparacao\"}"));
 assert.ok(board.includes("currentOsId!==item.entityId"));
 const list=read("gestao/AgroVooPilotOrders.tsx");
 assert.ok(list.includes("ownPilotOrders(orders,userId)"));
 assert.ok(list.includes("paginateAgroVooOrders(visible,page,10)"));
 assert.ok(list.includes("partial.areaRestanteHa"));
 assert.ok(!list.includes("localStorage"));
 assert.ok(!list.includes("fetch("));
 const page=read("gestao/page.tsx");
 assert.ok(page.includes("!canManage && isDroneGestorPilot"));
});
test("AgroVoo piloto: indicador de etapas não permite saltos e execução preserva ações",()=>{
 const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/campo/"+p,import.meta.url),"utf8");
 const flow=read("DroneGestorAppV3.tsx");
 assert.ok(flow.includes("indicador de navegação, não de aprovação"));
 assert.ok(flow.includes("i+1===guidedPhase[view]"));
 const field=read("DroneGuidedFieldMode.tsx");
 for(const handler of ["registerLoad","togglePause","undo","fillNext"])assert.ok(field.includes("onClick={"+handler+"}"));
 assert.ok(field.includes("Encerrar execução parcial"));
});
