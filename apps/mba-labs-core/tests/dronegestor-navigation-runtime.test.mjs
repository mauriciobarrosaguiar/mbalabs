import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {droneDeviceSwitchIssue} from '../src/lib/dronegestor-navigation.ts';

function device(values={}) {
 const data={'dronegestor:mission:v2':JSON.stringify({ordemServicoId:'OS-A'}),...values};
 return {getItem:key=>data[key]??null};
}
test('switching away from paused execution is blocked even when started is false',()=>{
 assert.ok(droneDeviceSwitchIssue(device({'dronegestor:started:v3':'false','dronegestor:paused:v3':'true'}),'OS-B'));
});
test('pending offline finalization cannot be discarded by selecting another OS',()=>{
 assert.ok(droneDeviceSwitchIssue(device({'dronegestor:finalizationQueue:v4':'[{"operationId":"pending"}]'}),'OS-B'));
});
test('orphaned tank records and area prevent destructive switching',()=>{
 for(const fields of [{'dronegestor:tankRecords:v4':'[{"areaHa":2}]'},{'dronegestor:progress:v2':'2'},{'dronegestor:operationId:v3':'op-A'}])
  assert.ok(droneDeviceSwitchIssue(device(fields),'OS-B'));
});
test('same OS can be inspected without dropping its checkpoint',()=>{
 assert.equal(droneDeviceSwitchIssue(device({'dronegestor:paused:v3':'true'}),'OS-A'),'');
});
test('confirmed finalization permits selecting a new OS; malformed storage fails closed',()=>{
 assert.equal(droneDeviceSwitchIssue(device({'dronegestor:missionStatus:v4':'"finalizada"','dronegestor:operationId:v3':'op-A','dronegestor:progress:v2':'2'}),'OS-B'),'');
 assert.ok(droneDeviceSwitchIssue(device({'dronegestor:mission:v2':'invalid'}),'OS-B'));
});
const read=name=>readFileSync(new URL(`../src/app/apps/dronegestor/${name}`,import.meta.url),'utf8');
test('document checklist receives the selected OS rather than the active device mission',()=>{
 assert.match(read('documentos/AgroDocDocuments.tsx'),/DroneDocumentsCenter key=.*osId=\{os\}/);
 const center=read('documentos/DroneDocumentsCenter.tsx');
 assert.match(center,/operacao-os\?osId=\$\{id\}/);
 assert.doesNotMatch(center,/localStorage/);
});
test('consulting a dossier never replaces the device mission; return links retain OS',()=>{
 const dossier=read('pacote-operacao/DroneOperationPackage.tsx');
 assert.doesNotMatch(dossier,/localStorage.setItem\("dronegestor:(?:mission:v2|activeMissionContext:v1)"/);
 assert.match(dossier,/if\(localMission\(\).ordemServicoId===osId\)/);
 assert.match(dossier,/gestao\?tab=os&osId=/);
 assert.match(read('gestao/planejamento/DroneMissionPlanning.tsx'),/gestao\?tab=os&osId=/);
});
test('device protection runs before server assignment and URL tabs react to query changes',()=>{
 const manage=read('gestao/DroneGestaoClientV3.tsx').split('async function openOrder(item:Item)')[1];
 assert.ok(manage.indexOf('droneDeviceSwitchIssue')<manage.indexOf('pilotoResponsavelId:currentUserId'));
 assert.match(read('gestao/DroneGestaoClientV3.tsx'),/\[searchParams,canManage\]/);
 assert.match(read('gestao/DroneGestaoClientV3.tsx'),/viewable=usable\|\|\["campo_concluido","concluida","cancelada"\]/);
});

test('cancelled dossier disables mutations and the property API rejects edits',()=>{
 const dossier=read('pacote-operacao/DroneOperationPackage.tsx');
 assert.match(dossier,/const readOnly=closed\|\|osStatus==="cancelada"/);
 assert.match(dossier,/canManage&&!readOnly&&<button/);
 const api=readFileSync(new URL('../src/app/api/dronegestor/operacao-os/route.ts',import.meta.url),'utf8');
 assert.match(api,/\["concluida", "cancelada"\].includes\(text\(data.status, 40\)\)/);
});
