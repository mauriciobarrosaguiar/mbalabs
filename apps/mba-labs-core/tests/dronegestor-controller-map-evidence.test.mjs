import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapPhotoPurpose, mapPhotoLogAction } from '../src/lib/dronegestor-map-photo-purpose.ts';

const source=(relative)=>readFileSync(new URL(relative,import.meta.url),'utf8');

test('photo of map on controller is stored distinctly from post-flight evidence',()=>{
 assert.equal(mapPhotoLogAction(mapPhotoPurpose('planejamento')),'mapa_controle_foto_v1');
 assert.equal(mapPhotoLogAction(mapPhotoPurpose('pos_voo')),'mapa_voo_evidencia');
 assert.equal(mapPhotoLogAction(mapPhotoPurpose(null)),'mapa_voo_evidencia');
 assert.equal(mapPhotoLogAction(mapPhotoPurpose(undefined)),'mapa_voo_evidencia');
 assert.notEqual(mapPhotoLogAction('planejamento'),mapPhotoLogAction('pos_voo'));
});

test('map API scopes reads and writes to OS and selected purpose, preserving old evidence',()=>{
 const api=source('../src/app/api/dronegestor/mapa/route.ts');
 assert.match(api,/const action = mapPhotoLogAction\(finalidade\)/);
 assert.match(api,/\.eq\("acao", action\)/);
 assert.match(api,/acao: action/);
 assert.match(api,/requireDroneOsAccess\(admin, current, osId\)/);
 assert.match(api,/requireDroneOsWriteAccess\(admin, current, ordemServicoId\)/);
 assert.match(api,/finalidade,/);
});

test('stage 4 explicitly offers either KML GeoJSON or controller screen photograph or both',()=>{
 const stage=source('../src/app/apps/dronegestor/campo/DroneGeoMapEvidence.tsx');
 assert.match(stage,/Mapa do talhão — arquivo, foto ou ambos/);
 assert.match(stage,/Opção 1 — Arquivo geográfico/);
 assert.match(stage,/Opção 2 — Foto do mapa na tela do controle/);
 assert.match(stage,/Carregar KML \/ GeoJSON/);
 assert.match(stage,/dronegestor:open-controller-map-photo/);
 assert.match(stage,/finalidade=planejamento/);
 assert.match(stage,/NÃO fornece automaticamente coordenadas/);
});

test('controller photo actions cannot accidentally fulfill the post-flight map checklist',()=>{
 const modal=source('../src/app/apps/dronegestor/campo/DroneMapEvidence.tsx');
 assert.match(modal,/form\.append\("finalidade",finalidade\)/);
 assert.match(modal,/dronegestor:map-control-photo-updated/);
 assert.match(modal,/dronegestor:map-evidence-updated/);
 assert.match(modal,/async function openPanel\(mode\?:Finalidade\)/);
 const docs=source('../src/app/apps/dronegestor/documentos/DroneDocumentsCenter.tsx');
 assert.match(docs,/mapa\?\.url/);
 const server=source('../src/app/api/dronegestor/mapa/route.ts');
 assert.match(server,/mapPhotoLogAction\(finalidade\)/);
 assert.match(server,/ordemServicoId: osId/);
});
