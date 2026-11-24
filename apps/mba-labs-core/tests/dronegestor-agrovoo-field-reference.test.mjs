import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {estimateFieldDeltaT,normalizeDropletMicrons,normalizeAssistantName} from "../src/lib/agrovoo-field-reference.ts";
test("Delta T: cálculo aproximado, sem substituir medição local",()=>{
 const result=estimateFieldDeltaT(27.8,28);
 assert.ok(result&&Math.abs(result.deltaC-11.5)<0.8);
 assert.ok(result.wetBulbC<27.8);
 for(const args of [[null,28],[27.8,null],[NaN,20],[-1,30],[51,30],[30,0],[30,100],["27.8",28]])assert.equal(estimateFieldDeltaT(...args),null);
});
test("AgroVoo formulário: preserva os controles de segurança, clima e conclusão existentes",()=>{
 const read=p=>readFileSync(new URL("../src/app/apps/dronegestor/campo/"+p,import.meta.url),"utf8");
 const main=read("DroneGestorAppV3.tsx"),field=read("DroneGuidedFieldMode.tsx");
 for(const label of ["1. Informações básicas da aplicação","2. Localização GPS","3. Condições meteorológicas","4. Parâmetros técnicos de voo","5. Equipe de aplicação"])assert.ok(main.includes(label));
 assert.ok(main.includes("DeltaTDisplay temperature={mission.temperaturaCampo} humidity={mission.umidadeCampo}"));
 assert.ok(main.includes('disabled={!missionReady||checkingPreflight||droneRecordPending}'));
 assert.ok(main.includes('disabled={!safetyReady} onClick={()=>guarded("calibracao")}'));
 assert.ok(main.includes("onClick={confirmClimate}"));
 assert.ok(field.includes("6. Observações adicionais"));
 assert.ok(field.includes("7. Evidências e conclusão"));
 assert.ok(field.includes('fixedPurpose="pos_voo"'));
 assert.ok(field.includes("onClick={()=>void finish()}"));
 assert.ok(field.includes("if(hasPartialPending())return flash"));
});

test("AgroVoo: metadados opcionais não inventam gota nem ajudante em registros legados",()=>{
 for(const value of [null,undefined,NaN,Infinity,-1,0,10001,"350"])assert.equal(normalizeDropletMicrons(value),null);
 assert.equal(normalizeDropletMicrons(350),350);
 assert.equal(normalizeAssistantName(undefined),"");
 assert.equal(normalizeAssistantName("  Ajudante de teste  "),"Ajudante de teste");
 assert.equal(normalizeAssistantName("a".repeat(200)).length,120);
});
test("AgroVoo: dados adicionais acompanham missão e resumo sem modificar os bloqueios",()=>{
 const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
 const field=read("app/apps/dronegestor/campo/DroneGestorAppV3.tsx");
 assert.ok(field.includes('key==="gotaMicra"||key==="ajudanteNome"'));
 assert.ok(field.includes('... (mission.gotaMicra'.replace("... ","..."))||field.includes('...(mission.gotaMicra!=null?[mission.gotaMicra]:[])'));
 assert.ok(field.includes('...(savedMission.gotaMicra!=null?[savedMission.gotaMicra]:[])'));
 const api=read("app/api/dronegestor/state/route.ts");
 assert.ok(api.includes("gotaMicra: normalizeDropletMicrons(mission.gotaMicra)"));
 assert.ok(api.includes("ajudanteNome: normalizeAssistantName(mission.ajudanteNome)"));
 for(const p of ["campo/DroneGuidedFieldMode.tsx","pacote-operacao/DroneFinalOsSummary.tsx","historico/DroneHistoricoClientV2.tsx","agrovoo/piloto/AgroVooPilotHome.tsx"]){
  const s=read("app/apps/dronegestor/"+p);assert.ok(s.includes("ajudanteNome")&&s.includes("gotaMicra"),p);
 }
});
