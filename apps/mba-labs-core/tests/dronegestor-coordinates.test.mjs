import test from 'node:test';
import assert from 'node:assert/strict';
import {hasDroneCoordinates} from '../src/lib/dronegestor-coordinates.ts';
test('GPS accepts real bounds and refuses coercion of missing/invalid values',()=>{
 for(const value of [null,undefined,'',' ',true,false,NaN,Infinity,{},[]]) {
 assert.equal(hasDroneCoordinates({latitude:value,longitude:0}),false);
 assert.equal(hasDroneCoordinates({latitude:0,longitude:value}),false);
 }
 assert.equal(hasDroneCoordinates({latitude:0,longitude:0}),true);
 assert.equal(hasDroneCoordinates({latitude:-90,longitude:180}),true);
 assert.equal(hasDroneCoordinates({latitude:91,longitude:0}),false);
 assert.equal(hasDroneCoordinates({latitude:0,longitude:-181}),false);
 assert.equal(hasDroneCoordinates({latitude:'-10.2',longitude:'-48.3'}),true);
});
