import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasCompleteDroneFieldClimate} from '../src/lib/dronegestor-field-climate.ts';

const measured={ventoCampoKmh:7,direcaoVentoCampo:'NE → SO',temperaturaCampo:27,umidadeCampo:62};

test('climate entry starts blocked until all measured inputs are supplied',()=>{
 for(const patch of [
  {ventoCampoKmh:null},{direcaoVentoCampo:''},{direcaoVentoCampo:'   '},
  {temperaturaCampo:null},{umidadeCampo:null},{ventoCampoKmh:-1},
  {ventoCampoKmh:101},{temperaturaCampo:61},{temperaturaCampo:-21},
  {umidadeCampo:0},{umidadeCampo:101},{ventoCampoKmh:Number.NaN},
  {temperaturaCampo:Number.POSITIVE_INFINITY},{umidadeCampo:Number.NaN},
 ]){
  assert.equal(hasCompleteDroneFieldClimate({...measured,...patch}),false,JSON.stringify(patch));
 }
});

test('presence and sanity range alone is not operational clearance',()=>{
 assert.equal(hasCompleteDroneFieldClimate(measured),true);
 const src=readFileSync(new URL('../src/app/apps/dronegestor/campo/DroneGestorAppV3.tsx',import.meta.url),'utf8');
 assert.match(src,/const climateInputReady = sensitiveReady && !marginBlocked && hasCompleteDroneFieldClimate\(mission\)/);
 assert.match(src,/disabled=\{locked\|\|!climateInputReady\}/);
 assert.match(src,/const safetyReady = Boolean\(sensitiveReady && !marginBlocked && weatherReady/);
 assert.match(src,/const canStart = missionReady && safetyReady && calibrationReady && checklistReady && sarpasReady && gpsReady/);
});
