import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canReactivatePilot,explicitPilotPermissions} from "../src/lib/agrovoo-pilot-reactivation.ts";
const pilot={ativo:false,usuarioId:"u",email:"u@example.invalid"};
const user={id:"u",empresa_id:"e",status:"ativo",email:"u@example.invalid",tipo:"usuario",tipo_global:"usuario"};
const permission={id:"p",usuario_id:"u",empresa_id:"e",perfil_app:"piloto",status:"inativo"};
test("reativação: exige identidade, empresa, vínculo inativo e perfil original",()=>{
 assert.equal(canReactivatePilot(pilot,user,permission,"e"),true);
 assert.equal(canReactivatePilot(pilot,user,{...permission,perfil_app:"aplicador_caar"},"e"),true);
 for(const [p,u,a,e] of [[{...pilot,ativo:true},user,permission,"e"],[pilot,{...user,empresa_id:"outra"},permission,"e"],[pilot,{...user,status:"inativo"},permission,"e"],[pilot,{...user,email:"other@example.invalid"},permission,"e"],[pilot,{...user,tipo_global:"admin_empresa"},permission,"e"],[pilot,user,{...permission,perfil_app:"gestor_operacional"},"e"],[pilot,user,{...permission,status:"ativo"},"e"],[pilot,user,permission,null],[pilot,user,null,"e"]])assert.equal(canReactivatePilot(p,u,a,e),false);
});
test("permissões omitidas ou valores não booleanos não liberam ações",()=>{
 assert.deepEqual(explicitPilotPermissions({executarOs:true,finalizarOperacao:true},{executarOs:true,finalizarOperacao:"true"}),{executarOs:true,finalizarOperacao:false});
 assert.deepEqual(explicitPilotPermissions({executarOs:true},null),{executarOs:false});
});
test("reativação reaproveita conta, não grava senha ou perfil",()=>{
 const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
 const route=read("app/api/dronegestor/pilotos/route.ts");
 const action=route.slice(route.indexOf('if(body?.action==="reativar")'),route.indexOf("if(row.detalhes?.ativo===false||Object.keys"));
 assert.ok(action.includes("canReactivatePilot"));
 assert.ok(action.includes('.eq("perfil_app",permission.data.perfil_app)'));
 assert.ok(action.includes('.update({status:"ativo"})'));
 assert.ok(action.includes('.update({status:"inativo"})'));
 assert.ok(!action.includes("createOrLinkPilotAccount"));
 assert.ok(!action.includes("senhaAcesso"));
 assert.ok(route.includes("current.canAdministerTeam&&request.nextUrl.searchParams.get"));
 const ui=read("app/apps/dronegestor/pilotos/DronePilotsManager.tsx");
 assert.ok(ui.includes('action:"reativar"'));
 const state=read("app/api/dronegestor/state/route.ts");
 assert.ok(state.includes("finalizarOperacao === true && data.detalhes?.permissoes?.executarOs === true"));
});
