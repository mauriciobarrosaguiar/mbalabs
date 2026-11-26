import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/"+p,import.meta.url),"utf8");
test("Receituário AgroVoo: consulta contextualizada da OS sem edição no dashboard",()=>{
 const home=read("agrovoo/piloto/AgroVooPilotHome.tsx");
 assert.ok(home.includes('key={order.entityId} onClose={()=>setProductSearch(false)}'));
 assert.ok(home.includes("setProductSearch(false)"));
 assert.ok(!home.includes("onSelect={"));
 assert.ok(home.includes("Produtos do planejamento da OS, não uma nova prescrição."));
});
test("Receituário AgroVoo: consulta oficial distingue fallback e descarta respostas antigas",()=>{
 const search=read("agrovoo/piloto/AgroVooProductSearch.tsx");
 assert.ok(search.includes("/api/dronegestor/produtos?q="));
 assert.ok(search.includes("request.current!==controller"));
 assert.ok(search.includes('item.officialSource==="AGROFIT / Dados Abertos MAPA"'));
 assert.ok(search.includes('url.protocol==="https:"'));
 assert.ok(!search.includes("localStorage"));
 assert.ok(!search.includes('method:"POST"'));
});
test("Receituário AgroVoo: edição utiliza estado original, permissão explícita e proteção de cargas anteriores",()=>{
 const field=read("campo/DroneGestorAppV3.tsx");
 assert.ok(field.includes("productPermission===permissionKey"));
 assert.ok(field.includes('own?.permissoes?.editarParametros===true?permissionKey:""'));
 assert.ok(field.includes('!locked&&missionStatus!=="parcial"&&progressHa===0&&tankRecords.length===0&&view==="nova"'));
 assert.ok(field.includes('if (!canEditProducts) return flash'));
 assert.ok(field.includes('patch.nome!==p.nome?{dose:0}'));
 assert.ok(field.includes("onSelect={name=>{if(!canEditProducts)return;updateProduct"));
 assert.ok(field.includes('sarpasConfirmado: false, sarpasSituacao: "", sarpasNumero: ""'));
 assert.ok(!read("campo/page.tsx").includes("<DroneProductMissionPicker"));
});
