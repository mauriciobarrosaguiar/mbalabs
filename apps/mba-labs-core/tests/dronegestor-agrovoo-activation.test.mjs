import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("AgroVoo: instalação separada sem credenciais no manifesto",()=>{
 const m=JSON.parse(read("public/agrovoo-piloto.webmanifest"));
 assert.equal(m.start_url,"/apps/agrovoo/piloto");
 assert.equal(m.display,"standalone");
 assert.ok(m.start_url.startsWith(m.scope));
 assert.deepEqual(m.icons.map(x=>x.sizes),["192x192","512x512"]);
 const ui=read("src/app/apps/dronegestor/agrovoo/piloto/AgroVooInstall.tsx");
 assert.ok(ui.includes("beforeinstallprompt"));
 assert.ok(!ui.includes("localStorage"));assert.ok(!ui.includes("fetch("));
 assert.ok(read("src/app/apps/dronegestor/agrovoo/piloto/page.tsx").includes('manifest:"/agrovoo-piloto.webmanifest"'));
});
test("AgroVoo: acesso ativo não equivale à autorização de executar OS",()=>{
 const s=read("src/app/apps/dronegestor/pilotos/DronePilotsManager.tsx");
 assert.ok(s.includes("const authorized=linked.filter(item=>item.permissoes.executarOs===true)"));
 assert.ok(s.includes("Boolean(item.usuarioId) && item.permissoes.executarOs===true"));
 assert.ok(s.includes('method: "DELETE"'));
 assert.ok(s.includes('!loaded || !canAdministerTeam'));
 assert.ok(s.includes("não representa limite contratado"));
});
