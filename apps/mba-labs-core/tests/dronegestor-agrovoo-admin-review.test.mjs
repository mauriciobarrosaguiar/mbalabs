import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/"+p,import.meta.url),"utf8");
test("visão dos cadastros aponta para formulários unificados",()=>{
 const c=read("cadastros/AgroDocRegistry.tsx");
 for(const key of ["aeronaves","clientes","propriedades","talhoes"])assert.ok(c.includes("cadastros/"+key+"?novo=1"));
 assert.ok(!c.includes("AgroDocTable"));assert.ok(!c.includes("gestao?tab="));
 const ui=read("agrovoo/cadastros/[tipo]/AgroVooRegistryClient.tsx");
 assert.ok(ui.includes('get("novo")==="1"'));assert.ok(ui.includes("confirmRef.current?.showModal()"));
 assert.ok(ui.includes("if(!canWrite||saving)return;"));
});
test("piloto mantém responsável existente e impede substituição não intencional",()=>{
 const c=read("pilotos/DronePilotsManager.tsx");
 assert.ok(c.includes('const [pilotChoice, setPilotChoice] = useState("");'));
 assert.ok(c.includes("linkedPilots.find(p=>p.usuarioId===id)"));
 assert.ok(c.includes("!pilotChoice || samePilot"));
 assert.ok(c.includes("agrovoo-pilot-create"));
 assert.ok(read("agrodoc.css").includes(".agrovoo-pilot-create{display:grid!important"));
});
test("painel gestor compacta sem alterar fonte de dados",()=>{
 assert.ok(read("gestao/DroneManagerOperationsPanel.tsx").includes("agro-compact-grid mt-4 grid grid-cols-2"));
 assert.ok(read("gestao/DroneManagerOperationsPanel.tsx").includes("/api/dronegestor/painel-gestor"));
 assert.ok(read("agrovoo/AgroVooBetaClient.tsx").includes("!text-white hover:brightness-110"));
});
