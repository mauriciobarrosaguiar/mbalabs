import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canonicalAgroVooPath,internalAgroVooPath} from "../src/lib/agrovoo-routes.ts";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
test("AgroVoo: entrada por perfil sem painel antigo",()=>{
 const root=read("app/apps/dronegestor/page.tsx");
 assert.ok(root.includes('if(canManageDroneGestor(role))redirect("/apps/agrovoo/painel")'));
 assert.ok(root.includes('if(isDroneGestorPilot(role))redirect("/apps/agrovoo/piloto")'));
 assert.ok(root.includes('requireAppAccess("dronegestor"'));
 assert.ok(!root.includes("VERCEL_ENV"));
 assert.ok(!root.includes("DroneHomeDashboard"));
 assert.ok(!read("app/apps/dronegestor/agrovoo/AgroVooAdminShell.tsx").includes("Painel anterior"));
 assert.ok(read("app/apps/dronegestor/agrovoo/page.tsx").includes('if (!canManage) redirect'));
});
test("AgroVoo: URL pública canônica, sem alterar identificadores de dados",()=>{
 for(const [old,next] of [["/apps/dronegestor","/apps/agrovoo"],["/apps/dronegestor/agrovoo","/apps/agrovoo/painel"],["/apps/dronegestor/agrovoo/piloto","/apps/agrovoo/piloto"],["/apps/dronegestor/agrovoo/os/abc","/apps/agrovoo/os/abc"],["/apps/dronegestor/agrovoo/cadastros/clientes","/apps/agrovoo/cadastros/clientes"],["/apps/dronegestor/campo","/apps/agrovoo/campo"],["/apps/dronegestor/gestao","/apps/agrovoo/gestao"]]){
  assert.equal(canonicalAgroVooPath(old),next);assert.equal(internalAgroVooPath(next),old);
 }
 assert.equal(canonicalAgroVooPath("/apps/dronegestor/gestao?osId=a%26b&abrir=1"),"/apps/agrovoo/gestao?osId=a%26b&abrir=1");
 assert.equal(canonicalAgroVooPath("/api/dronegestor/state"),"/api/dronegestor/state");
 assert.equal(canonicalAgroVooPath("/apps/dronegestor-outro"),"/apps/dronegestor-outro");
 const proxy=read("proxy.ts");assert.ok(proxy.includes("NextResponse.rewrite"));assert.ok(proxy.includes("NextResponse.redirect(url,307)"));
 assert.ok(read("lib/core-data.ts").includes('if(path==="/apps/agrovoo"||path.startsWith("/apps/agrovoo/"))return "dronegestor"'));
});
