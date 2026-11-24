import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {estimateFieldDeltaT} from "../src/lib/agrovoo-field-reference.ts";
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
