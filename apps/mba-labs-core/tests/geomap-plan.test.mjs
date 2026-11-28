import test from "node:test";
import assert from "node:assert/strict";
import {dependencies,makePlan,defaultConfig} from "../src/app/apps/geomap/processing-plan.ts";
const input={projectId:null,photos:{count:29,bytes:1000,gps:29,unsupported:0,duplicates:0},selected:["curvas","rgb","3d"],config:defaultConfig};
test("resolve derived product dependencies",()=>assert.deepEqual(dependencies(input.selected),["orto","mdt","curvas","nuvem","3d","rgb"]));
test("plan stays draft and seven-day retention is fixed",()=>{const p=makePlan(input);assert.equal(p.status,"draft");assert.equal(p.retentionHours,168);assert.equal(p.submitted,false);assert.equal(p.uploaded,false);assert.equal(p.accuracyVerified,false);});
test("reject invalid files, products, coordinates, ownership and settings",()=>{for(const x of [{photos:{...input.photos,unsupported:1}},{photos:{...input.photos,gps:30}},{selected:[]},{selected:["NDVI"]},{config:{...defaultConfig,resolutionCm:0}},{projectId:"bad"},{submitted:true}])assert.throws(()=>makePlan({...input,...x}));});
