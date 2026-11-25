import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../src/app/apps/dronegestor/" + path, import.meta.url),"utf8");
test("AgroVoo: páginas de cadastros exigem sessão e autorização de gestão",()=>{
  const page=read("agrovoo/cadastros/[tipo]/page.tsx");
  assert.match(page,/await requireAppAccess\("dronegestor"/);
  assert.match(page,/if \(!canManageDroneGestor\(/);
  assert.match(page,/notFound\(\)/);
  assert.match(page,/<DronePilotQualifications\/><DronePilotsManager compact\/>/);
});
test("AgroVoo: menu e dashboard usam as mesmas rotas de cadastro",()=>{
  const shell=read("agrovoo/AgroVooAdminShell.tsx");
  const board=read("agrovoo/AgroVooBetaClient.tsx");
  for(const kind of ["clientes","propriedades","talhoes","aeronaves","pilotos"]){
    assert.ok(shell.includes("cadastros/"+kind));
    assert.ok(board.includes("cadastros/"+kind));
  }
});
test("AgroVoo: cadastro utiliza APIs existentes, protege gravações e confirma inativação",()=>{
  const ui=read("agrovoo/cadastros/[tipo]/AgroVooRegistryClient.tsx");
  assert.ok(ui.includes("/api/dronegestor/equipamentos"));
  assert.ok(ui.includes("/api/dronegestor/cadastros"));
  assert.ok(ui.includes('if(!canWrite||saving)return;'));
  assert.ok(ui.includes('payload?.ok!==true'));
  assert.ok(ui.includes("confirmRef.current?.showModal()"));
  assert.ok(ui.includes('void mutate("DELETE",undefined,id)'));
  assert.ok(ui.includes("paginateAgroVooOrders(filtered,page,size)"));
});
test("AgroVoo: piloto continua submetido aos controles existentes de administração",()=>{
  const pilot=read("pilotos/DronePilotsManager.tsx");
  assert.ok(pilot.includes("compact=false"));
  assert.ok(pilot.includes("if (!canManage || !canCreatePilot || saving) return;"));
  assert.ok(pilot.includes("canManage={canAdministerTeam && !teamUnavailable}"));
  assert.ok(pilot.includes("const visiblePilots=compact?visibleOrders:items;"));
});
