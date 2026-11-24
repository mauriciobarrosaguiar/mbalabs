import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/"+p,import.meta.url),"utf8");
test("AgroVoo: entrada da prévia por perfil e acesso explícito ao painel anterior",()=>{
 const root=read("page.tsx");
 assert.ok(root.includes('if(canManage&&legacy!=="1"&&(process.env.VERCEL_ENV==="preview"||process.env.NODE_ENV==="development"))redirect("/apps/dronegestor/agrovoo")'));
 assert.ok(root.includes('redirect("/apps/dronegestor/agrovoo/piloto")'));
 assert.ok(root.indexOf('redirect("/apps/dronegestor/agrovoo/piloto")')<root.indexOf('if(canManage&&legacy'));
 assert.ok(root.includes('requireAppAccess("dronegestor"'));
 assert.ok(read("agrovoo/AgroVooAdminShell.tsx").includes('href={ROOT+"?legacy=1"}'));
 assert.ok(read("agrovoo/page.tsx").includes('if (!canManage) redirect'));
});
