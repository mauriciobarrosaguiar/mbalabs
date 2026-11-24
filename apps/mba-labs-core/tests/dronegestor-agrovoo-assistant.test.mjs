import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assistantNames} from "../src/lib/agrovoo-assistant-directory.ts";
test("Lista de ajudantes: nomes apenas, exclusão do próprio piloto e inativos",()=>{
 assert.deepEqual(assistantNames([{id:"self",nome:"Piloto",status:"ativo"},{id:"1",nome:" Bruno ",status:"ativo",email:"privado"},{id:"2",nome:"Ana",status:"ativo"},{id:"3",nome:"Bruno",status:"ativo"},{id:"4",nome:"Inativo",status:"inativo"}],"self"),["Ana","Bruno"]);
 assert.deepEqual(assistantNames(null,"self"),[]);
});
test("Consulta exige OS acessível, preparação, empresa e permissões ativas",()=>{
 const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
 const api=read("app/api/dronegestor/ajudantes/route.ts");
 assert.ok(api.includes("requireDroneOsAccess(admin,{userId:p.id,empresaId:p.empresa_id,canManage},osId)"));
 assert.ok(api.includes('.eq("empresa_id",p.empresa_id)'));
 assert.ok(api.includes('.eq("status","ativo")'));
 assert.ok(api.includes('select("id,nome,status")'));
 assert.ok(api.includes("private, no-store"));
 assert.ok(!api.includes("export async function POST"));
 const ui=read("app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
 assert.ok(ui.includes('disabled={!canEditProducts} value={mission.ajudanteNome||""}'));
});
