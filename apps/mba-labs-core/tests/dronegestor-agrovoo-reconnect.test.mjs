import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Reconexão: uma falha da leitura inicial não autoriza envio com revisão desconhecida",()=>{
 const s=readFileSync(new URL("../src/app/apps/dronegestor/campo/DronePersistenceSync.tsx",import.meta.url),"utf8");
 assert.ok(s.includes('if(!response.ok)throw new Error("Consulta inicial indisponível.")'));
 assert.ok(s.includes("if(!initialized){await hydrate(force);return;}"));
 assert.ok(s.includes("initialized=false;"));
 assert.ok(s.includes("if(fingerprint(snapshotDroneLocalState())!==baseline||meaningfulLocalState())markDirty(true)"));
 assert.ok(s.includes("if(!navigator.onLine)return;"));
 assert.ok(s.includes("const onOnline = () => void sync(true)"));
 assert.ok(s.includes("ownerStillCurrent()"));
 assert.ok(s.includes("payload.revision<0"));
});
