import test from 'node:test';
import assert from 'node:assert/strict';
import { droneSyncAcknowledgement } from '../src/lib/dronegestor-sync-guard.ts';
test('edição durante upload permanece pendente',()=>{
 assert.deepEqual(droneSyncAcknowledgement('A:u','A:u','before','after'),{sameOwner:true,unchanged:false});
});
test('resposta da conta anterior não deve alterar revisão da conta atual',()=>{
 assert.equal(droneSyncAcknowledgement('A:u','B:u','same','same').sameOwner,false);
});
test('mesmo snapshot e proprietário podem ser confirmados',()=>{
 assert.deepEqual(droneSyncAcknowledgement('A:u','A:u','same','same'),{sameOwner:true,unchanged:true});
});
